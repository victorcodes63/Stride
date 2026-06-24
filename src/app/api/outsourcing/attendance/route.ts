import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  listEntitySwitcherOutsourcingClientIds,
  resolvePrimaryWorkspaceClientId,
} from '@/lib/primary-workspace-client';
import {
  employeeNumberPrefixForAttendanceRegion,
  parseAttendanceRegionParam,
} from '@/lib/attendance-region-filter';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { reconcileAttendanceDay, resolveReconcileWorkDatesForObservedAt } from '@/lib/attendance-reconciliation';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { unauthorizedResponse } from '@/lib/demo-route-access';
import { logAuditEvent } from '@/lib/audit-events';
import { getEssPortalUserIdForEmployee, sendNotification } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const requestedClientId = request.nextUrl.searchParams.get('clientId') || undefined;
    const combinedRaw = request.nextUrl.searchParams.get('combinedEntities');
    const combinedEntities =
      combinedRaw === '1' || combinedRaw === 'true' || combinedRaw === 'yes';

    /** Single client (entity cookie) or multiple when UI requests both KE & UG legal employers. */
    let clientId: string;
    let clientIds: string[] | null = null;
    if (combinedEntities) {
      const multi = await listEntitySwitcherOutsourcingClientIds(prisma);
      if (multi.length > 1) {
        clientIds = multi;
        clientId = multi[0]!; // unused when clientIds set; satisfies legacy branches
      } else {
        clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);
      }
    } else {
      clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);
    }

    const from = request.nextUrl.searchParams.get('from') || undefined;
    const to = request.nextUrl.searchParams.get('to') || undefined;
    const employeeId = request.nextUrl.searchParams.get('employeeId') || undefined;
    const region = parseAttendanceRegionParam(request.nextUrl.searchParams.get('region'));
    const regionPrefix = region ? employeeNumberPrefixForAttendanceRegion(region) : null;

    const clientScope =
      clientIds && clientIds.length > 1
        ? { outsourcingClientId: { in: clientIds } }
        : { outsourcingClientId: clientId };

    const where = {
      ...clientScope,
      ...(employeeId ? { employeeId } : {}),
      ...(regionPrefix
        ? {
            employee: {
              employeeNumber: { startsWith: regionPrefix, mode: 'insensitive' },
            },
          }
        : {}),
      ...(from || to
        ? {
            workDate: {
              ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
              ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
    };

    const prismaAny = prisma as unknown as {
      attendanceDaySummary?: {
        findMany: (args: unknown) => Promise<unknown[]>;
      };
      attendanceException?: {
        findMany: (args: unknown) => Promise<unknown[]>;
      };
    };
    const hasSummaryModel = typeof prismaAny.attendanceDaySummary?.findMany === 'function';
    const hasExceptionModel = typeof prismaAny.attendanceException?.findMany === 'function';

    let summaries: unknown[] = [];
    if (hasSummaryModel) {
      summaries = await prismaAny.attendanceDaySummary!.findMany({
        where,
        include: {
          employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
        },
        orderBy: [{ workDate: 'desc' }, { employee: { lastName: 'asc' } }],
        take: 400,
      });
    } else {
      // Compatibility fallback: derive summary-like rows from legacy Attendance.
      const attendanceRows = await prisma.attendance.findMany({
        where: {
          ...(employeeId ? { employeeId } : {}),
          ...(from || to
            ? {
                date: {
                  ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
                  ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
                },
              }
            : {}),
          employee: {
            ...(clientIds && clientIds.length > 1
              ? { outsourcingClientId: { in: clientIds } }
              : { outsourcingClientId: clientId }),
            ...(regionPrefix
              ? {
                  employeeNumber: { startsWith: regionPrefix, mode: 'insensitive' },
                }
              : {}),
          },
        },
        include: {
          employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
        },
        orderBy: [{ date: 'desc' }, { employee: { lastName: 'asc' } }],
        take: 400,
      });
      summaries = attendanceRows.map((row) => {
        const workedMinutes =
          row.checkIn && row.checkOut
            ? Math.max(0, Math.round((row.checkOut.getTime() - row.checkIn.getTime()) / 60000))
            : 0;
        return {
          id: row.id,
          employeeId: row.employeeId,
          workDate: row.date,
          firstInAt: row.checkIn,
          lastOutAt: row.checkOut,
          minutesWorked: workedMinutes,
          lateMinutes: 0,
          overtimeMinutes: 0,
          holidayOvertimeMinutes: 0,
          publicHolidayName: null,
          status: row.checkOut ? 'reconciled' : 'draft',
          employee: row.employee,
        };
      });
    }

    let exceptions: unknown[] = [];
    if (hasExceptionModel) {
      exceptions = await prismaAny.attendanceException!.findMany({
        where: {
          ...(employeeId ? { employeeId } : {}),
          employee: {
            ...(clientIds && clientIds.length > 1
              ? { outsourcingClientId: { in: clientIds } }
              : { outsourcingClientId: clientId }),
            ...(regionPrefix
              ? {
                  employeeNumber: { startsWith: regionPrefix, mode: 'insensitive' },
                }
              : {}),
          },
          ...(from || to
            ? {
                workDate: {
                  ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
                  ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
                },
              }
            : {}),
        },
        include: {
          employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
        },
        orderBy: [{ status: 'asc' }, { workDate: 'desc' }],
        take: 300,
      });
    }

    return NextResponse.json({ summaries, exceptions, attendanceV2: isFeatureEnabled('attendanceV2') });
  } catch (error) {
    console.error('[outsourcing/attendance GET]', error);
    return NextResponse.json({ error: 'Failed to load attendance data.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : '';
    const observedAtRaw = typeof body.observedAt === 'string' ? body.observedAt.trim() : '';
    const kindRaw = typeof body.kind === 'string' ? body.kind.trim() : 'check_in';
    if (!employeeId || !observedAtRaw) {
      return NextResponse.json({ error: 'employeeId and observedAt are required.' }, { status: 400 });
    }
    const observedAt = new Date(observedAtRaw);
    if (Number.isNaN(observedAt.getTime())) {
      return NextResponse.json({ error: 'Invalid observedAt datetime.' }, { status: 400 });
    }
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { outsourcingClientId: true },
    });
    if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

    const workDate = observedAt.toISOString().slice(0, 10);
    await prisma.attendanceEvent.create({
      data: {
        employeeId,
        outsourcingClientId: employee.outsourcingClientId,
        observedAt,
        workDate: new Date(`${workDate}T00:00:00.000Z`),
        source: 'manual',
        kind: kindRaw === 'check_out' ? 'check_out' : 'check_in',
        isApprovedOverride: true,
      },
    });
    const workDates = await resolveReconcileWorkDatesForObservedAt(prisma, employeeId, observedAt);
    const summaries = await Promise.all(
      workDates.map((dateKey) => reconcileAttendanceDay(prisma, { employeeId, workDate: dateKey }))
    );
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'attendance.manual_correction',
      entityType: 'AttendanceEvent',
      entityId: employeeId,
      route: 'POST /api/outsourcing/attendance',
      metadata: { employeeId, workDate, kind: kindRaw === 'check_out' ? 'check_out' : 'check_in' },
    });
    try {
      const essId = await getEssPortalUserIdForEmployee(employeeId);
      if (essId) {
        await sendNotification({
          event: 'attendance_corrected',
          recipientEssPortalUserIds: [essId],
          title: 'Attendance corrected',
          body: `Your attendance record for ${workDate} has been updated by ${user.name}.`,
          href: '/ess/attendance',
          priority: 'info',
          channel: 'in_app',
          metadata: { employeeId, date: workDate, corrector: user.name },
        });
      }
    } catch (err) {
      console.error('[notifications] Failed to send attendance_corrected:', err);
    }
    return NextResponse.json({ ok: true, summary: summaries[0] ?? null, reconciledDates: workDates });
  } catch (error) {
    console.error('[outsourcing/attendance POST]', error);
    return NextResponse.json({ error: 'Failed to add attendance event.' }, { status: 500 });
  }
}

