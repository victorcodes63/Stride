import { NextRequest, NextResponse } from 'next/server';
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
import { getEssPortalUserIdForEmployee, sendNotification } from '@/lib/notifications';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
      }

      const summariesAndExceptions = await ctx.run(async (tx) => {
        const requestedClientId = request.nextUrl.searchParams.get('clientId') || undefined;
        const combinedRaw = request.nextUrl.searchParams.get('combinedEntities');
        const combinedEntities =
          combinedRaw === '1' || combinedRaw === 'true' || combinedRaw === 'yes';

        let clientId: string;
        let clientIds: string[] | null = null;
        if (combinedEntities) {
          const multi = await listEntitySwitcherOutsourcingClientIds(tx);
          if (multi.length > 1) {
            clientIds = multi;
            clientId = multi[0]!;
          } else {
            clientId = await resolvePrimaryWorkspaceClientId(
              tx,
              requestedClientId,
              request,
              ctx.organizationId,
            );
          }
        } else {
          clientId = await resolvePrimaryWorkspaceClientId(
            tx,
            requestedClientId,
            request,
            ctx.organizationId,
          );
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
          ...ctx.where(),
          ...clientScope,
          ...(employeeId ? { employeeId } : {}),
          ...(regionPrefix
            ? {
                employee: {
                  employeeNumber: { startsWith: regionPrefix, mode: 'insensitive' as const },
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

        const txAny = tx as unknown as {
          attendanceDaySummary?: {
            findMany: (args: unknown) => Promise<unknown[]>;
          };
          attendanceException?: {
            findMany: (args: unknown) => Promise<unknown[]>;
          };
        };
        const hasSummaryModel = typeof txAny.attendanceDaySummary?.findMany === 'function';
        const hasExceptionModel = typeof txAny.attendanceException?.findMany === 'function';

        let summaries: unknown[] = [];
        if (hasSummaryModel) {
          summaries = await txAny.attendanceDaySummary!.findMany({
            where,
            include: {
              employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
            },
            orderBy: [{ workDate: 'desc' }, { employee: { lastName: 'asc' } }],
            take: 400,
          });
        } else {
          const attendanceRows = await tx.attendance.findMany({
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
                      employeeNumber: { startsWith: regionPrefix, mode: 'insensitive' as const },
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
          exceptions = await txAny.attendanceException!.findMany({
            where: {
              ...ctx.where(),
              ...(employeeId ? { employeeId } : {}),
              employee: {
                ...(clientIds && clientIds.length > 1
                  ? { outsourcingClientId: { in: clientIds } }
                  : { outsourcingClientId: clientId }),
                ...(regionPrefix
                  ? {
                      employeeNumber: { startsWith: regionPrefix, mode: 'insensitive' as const },
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

        return { summaries, exceptions };
      });

      return NextResponse.json({
        ...summariesAndExceptions,
        attendanceV2: isFeatureEnabled('attendanceV2'),
      });
    } catch (error) {
      console.error('[outsourcing/attendance GET]', error);
      return NextResponse.json({ error: 'Failed to load attendance data.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
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

      const result = await ctx.run(async (tx) => {
        const employee = await tx.employee.findFirst({
          where: ctx.where({ id: employeeId }),
          select: { outsourcingClientId: true },
        });
        if (!employee) return null;

        const workDate = observedAt.toISOString().slice(0, 10);
        await tx.attendanceEvent.create({
          data: {
            organizationId: ctx.organizationId,
            employeeId,
            outsourcingClientId: employee.outsourcingClientId,
            observedAt,
            workDate: new Date(`${workDate}T00:00:00.000Z`),
            source: 'manual',
            kind: kindRaw === 'check_out' ? 'check_out' : 'check_in',
            isApprovedOverride: true,
          },
        });
        const workDates = await resolveReconcileWorkDatesForObservedAt(tx, employeeId, observedAt);
        const summaries = await Promise.all(
          workDates.map((dateKey) => reconcileAttendanceDay(tx, { employeeId, workDate: dateKey })),
        );
        return { workDate, kindRaw, summaries, workDates };
      });

      if (!result) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

      await ctx.audit({
        action: 'attendance.manual_correction',
        entityType: 'AttendanceEvent',
        entityId: employeeId,
        route: 'POST /api/outsourcing/attendance',
        metadata: { employeeId, workDate: result.workDate, kind: result.kindRaw === 'check_out' ? 'check_out' : 'check_in' },
      });

      try {
        const essId = await getEssPortalUserIdForEmployee(employeeId);
        if (essId) {
          await sendNotification({
            event: 'attendance_corrected',
            recipientEssPortalUserIds: [essId],
            title: 'Attendance corrected',
            body: `Your attendance record for ${result.workDate} has been updated by ${ctx.staff.name}.`,
            href: '/ess/attendance',
            priority: 'info',
            channel: 'in_app',
            metadata: { employeeId, date: result.workDate, corrector: ctx.staff.name },
          });
        }
      } catch (err) {
        console.error('[notifications] Failed to send attendance_corrected:', err);
      }

      return NextResponse.json({
        ok: true,
        summary: result.summaries[0] ?? null,
        reconciledDates: result.workDates,
      });
    } catch (error) {
      console.error('[outsourcing/attendance POST]', error);
      return NextResponse.json({ error: 'Failed to add attendance event.' }, { status: 500 });
    }
  });
}
