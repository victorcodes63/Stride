import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { staffUserCanManageAttendance } from '@/lib/staff-time-attendance/attendance-access';
import {
  reconcileStaffAttendanceDay,
  resolveStaffReconcileWorkDatesForObservedAt,
} from '@/lib/staff-time-attendance/reconciliation';
import { listOrgStaffUserIds } from '@/lib/staff-time-attendance/staff-directory';
import {
  serializeStaffException,
  serializeStaffSummary,
  todayWorkDate,
  toWorkDateUtc,
} from '@/lib/staff-time-attendance/attendance-serialize';

const SUMMARY_USER_SELECT = {
  select: { id: true, name: true, email: true, department: true },
} as const;

/**
 * GET /api/staff/attendance
 * Day summaries + exceptions + KPI header for internal staff (tenant-own).
 * Filters: from, to, department, status, search (staff name/email), userId.
 */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const sp = request.nextUrl.searchParams;
    const from = sp.get('from')?.trim() || undefined;
    const to = sp.get('to')?.trim() || undefined;
    const department = sp.get('department')?.trim() || undefined;
    const status = sp.get('status')?.trim() || undefined;
    const search = sp.get('search')?.trim() || undefined;
    const userId = sp.get('userId')?.trim() || undefined;
    const today = todayWorkDate();

    const data = await ctx.run(async (tx) => {
      const staffIds = await listOrgStaffUserIds(tx, ctx.organizationId);
      if (staffIds.length === 0) {
        return { summaries: [], exceptions: [], kpis: emptyKpis(), departments: [] };
      }

      const userFilter: Record<string, unknown> = {};
      if (department) userFilter.department = department;
      if (search) {
        userFilter.OR = [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ];
      }
      const hasUserFilter = Object.keys(userFilter).length > 0;

      const dateFilter =
        from || to
          ? {
              workDate: {
                ...(from ? { gte: toWorkDateUtc(from) } : {}),
                ...(to ? { lte: toWorkDateUtc(to) } : {}),
              },
            }
          : {};

      const summaryWhere = ctx.where({
        userId: userId ? userId : { in: staffIds },
        ...(status && status !== 'all' ? { status } : {}),
        ...dateFilter,
        ...(hasUserFilter ? { user: userFilter } : {}),
      }) as unknown as Prisma.StaffAttendanceDaySummaryWhereInput;

      const summaries = await tx.staffAttendanceDaySummary.findMany({
        where: summaryWhere,
        include: { user: SUMMARY_USER_SELECT },
        orderBy: [{ workDate: 'desc' }, { user: { name: 'asc' } }],
        take: 500,
      });

      const exceptions = await tx.staffAttendanceException.findMany({
        where: ctx.where({
          userId: userId ? userId : { in: staffIds },
          ...dateFilter,
          ...(hasUserFilter ? { user: userFilter } : {}),
        }) as unknown as Prisma.StaffAttendanceExceptionWhereInput,
        include: {
          user: SUMMARY_USER_SELECT,
          resolvedByUser: { select: { id: true, name: true } },
        },
        orderBy: [{ status: 'asc' }, { workDate: 'desc' }],
        take: 400,
      });

      // KPIs (today-scoped for present/late; open exceptions org-wide).
      const todaySummaries = await tx.staffAttendanceDaySummary.findMany({
        where: ctx.where({ userId: { in: staffIds }, workDate: toWorkDateUtc(today) }),
        select: { firstInAt: true, lastOutAt: true, lateMinutes: true, minutesWorked: true },
      });
      const openExceptionsCount = await tx.staffAttendanceException.count({
        where: ctx.where({ userId: { in: staffIds }, status: 'open' }) as unknown as Prisma.StaffAttendanceExceptionWhereInput,
      });

      const presentToday = todaySummaries.filter((s) => s.firstInAt != null).length;
      const lateToday = todaySummaries.filter((s) => s.lateMinutes > 0).length;

      const workedMinutes = summaries
        .map((s) => s.minutesWorked)
        .filter((m) => m > 0);
      const avgHours =
        workedMinutes.length > 0
          ? workedMinutes.reduce((sum, m) => sum + m, 0) / workedMinutes.length / 60
          : 0;

      const departments = await tx.user.findMany({
        where: { id: { in: staffIds }, department: { not: null } },
        select: { department: true },
        distinct: ['department'],
        orderBy: { department: 'asc' },
      });

      return {
        summaries: summaries.map(serializeStaffSummary),
        exceptions: exceptions.map(serializeStaffException),
        kpis: {
          presentToday,
          lateToday,
          openExceptions: openExceptionsCount,
          avgHours: Math.round(avgHours * 100) / 100,
        },
        departments: departments
          .map((d) => d.department)
          .filter((d): d is string => Boolean(d)),
      };
    });

    return NextResponse.json({ ...data, canManage: staffUserCanManageAttendance(ctx.staff) });
  });
}

function emptyKpis() {
  return { presentToday: 0, lateToday: 0, openExceptions: 0, avgHours: 0 };
}

/**
 * POST /api/staff/attendance
 * Manual attendance override — adds a check_in/check_out event for a staff user,
 * then reconciles the affected day(s). Manage-permission required.
 */
export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!staffUserCanManageAttendance(ctx.staff)) {
      return NextResponse.json({ error: 'Not allowed to edit attendance.' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const observedAtRaw = typeof body.observedAt === 'string' ? body.observedAt.trim() : '';
    const kindRaw = typeof body.kind === 'string' ? body.kind.trim() : 'check_in';
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
    if (!userId || !observedAtRaw) {
      return NextResponse.json({ error: 'userId and observedAt are required.' }, { status: 400 });
    }
    const observedAt = new Date(observedAtRaw);
    if (Number.isNaN(observedAt.getTime())) {
      return NextResponse.json({ error: 'Invalid observedAt datetime.' }, { status: 400 });
    }
    const kind = kindRaw === 'check_out' ? 'check_out' : 'check_in';

    const result = await ctx.run(async (tx) => {
      const staffIds = await listOrgStaffUserIds(tx, ctx.organizationId);
      if (!staffIds.includes(userId)) return { error: 'Staff member not found.' as const };

      const workDate = observedAt.toISOString().slice(0, 10);
      await tx.staffAttendanceEvent.create({
        data: {
          organizationId: ctx.organizationId,
          userId,
          observedAt,
          workDate: toWorkDateUtc(workDate),
          source: 'manual',
          kind,
          isApprovedOverride: true,
          createdByUserId: ctx.staff.id,
          notes,
        },
      });

      const workDates = await resolveStaffReconcileWorkDatesForObservedAt(tx, userId, observedAt);
      const summaries = await Promise.all(
        workDates.map((dateKey) =>
          reconcileStaffAttendanceDay(tx, ctx.organizationId, { userId, workDate: dateKey, actorUserId: ctx.staff.id }),
        ),
      );
      return { workDate, kind, workDates, summary: summaries[0] ?? null };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    await ctx.audit({
      action: 'staff_attendance.manual_override',
      entityType: 'StaffAttendanceEvent',
      entityId: userId,
      route: 'POST /api/staff/attendance',
      metadata: { userId, workDate: result.workDate, kind: result.kind, reconciledDates: result.workDates },
    });

    return NextResponse.json({
      ok: true,
      summary: result.summary ? serializeStaffSummary(result.summary) : null,
      reconciledDates: result.workDates,
    });
  });
}
