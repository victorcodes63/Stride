import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { staffUserCanManageAttendance } from '@/lib/staff-time-attendance/attendance-access';
import { reconcileStaffAttendanceDay } from '@/lib/staff-time-attendance/reconciliation';
import { serializeStaffSummary } from '@/lib/staff-time-attendance/attendance-serialize';

const USER_SELECT = { select: { id: true, name: true, email: true, department: true } } as const;

/**
 * PATCH /api/staff/attendance/summaries/[id]
 * Approve a day summary (status -> approved) or re-run reconciliation for the day.
 * Body: { action: 'approve' | 'reopen' | 'reconcile' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!staffUserCanManageAttendance(ctx.staff)) {
      return NextResponse.json({ error: 'Not allowed to approve attendance.' }, { status: 403 });
    }

    const { id } = await params;
    let body: { action?: string };
    try {
      body = (await request.json()) as { action?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const action = body.action;
    if (action !== 'approve' && action !== 'reopen' && action !== 'reconcile') {
      return NextResponse.json({ error: 'action must be approve, reopen, or reconcile.' }, { status: 400 });
    }

    const result = await ctx.run(async (tx) => {
      const existing = await tx.staffAttendanceDaySummary.findFirst({
        where: ctx.where({ id }),
        select: { id: true, userId: true, workDate: true },
      });
      if (!existing) return { error: 'not_found' as const };

      if (action === 'reconcile') {
        const summary = await reconcileStaffAttendanceDay(tx, ctx.organizationId, {
          userId: existing.userId,
          workDate: existing.workDate.toISOString().slice(0, 10),
          actorUserId: ctx.staff.id,
        });
        const withUser = await tx.staffAttendanceDaySummary.findFirst({
          where: { id: summary.id },
          include: { user: USER_SELECT },
        });
        return { summary: withUser };
      }

      const updated = await tx.staffAttendanceDaySummary.update({
        where: { id: existing.id },
        data: { status: action === 'approve' ? 'approved' : 'reconciled' },
        include: { user: USER_SELECT },
      });
      return { summary: updated };
    });

    if ('error' in result) {
      return NextResponse.json({ error: 'Day summary not found.' }, { status: 404 });
    }

    await ctx.audit({
      action: `staff_attendance.day.${action}`,
      entityType: 'StaffAttendanceDaySummary',
      entityId: id,
      route: 'PATCH /api/staff/attendance/summaries/[id]',
      metadata: { action },
    });

    return NextResponse.json({
      ok: true,
      summary: result.summary ? serializeStaffSummary(result.summary) : null,
    });
  });
}
