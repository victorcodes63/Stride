import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { staffUserCanManageAttendance } from '@/lib/staff-time-attendance/attendance-access';
import { listOrgStaffUserIds } from '@/lib/staff-time-attendance/staff-directory';
import { toWorkDateUtc } from '@/lib/staff-time-attendance/attendance-serialize';

/**
 * POST /api/staff/attendance/policies/assignments
 * Assign an attendance policy to a staff user. When isPrimary (default), any
 * existing primary assignment for that user is demoted first.
 * Body: { userId, staffAttendancePolicyId, effectiveFrom?, effectiveTo?, isPrimary? }
 */
export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!staffUserCanManageAttendance(ctx.staff)) {
      return NextResponse.json({ error: 'Not allowed to assign policies.' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const policyId =
      typeof body.staffAttendancePolicyId === 'string' ? body.staffAttendancePolicyId.trim() : '';
    if (!userId || !policyId) {
      return NextResponse.json({ error: 'userId and staffAttendancePolicyId required.' }, { status: 400 });
    }
    const isPrimary = body.isPrimary !== false;
    const effectiveFrom =
      typeof body.effectiveFrom === 'string' && body.effectiveFrom.trim()
        ? toWorkDateUtc(body.effectiveFrom.trim())
        : toWorkDateUtc(new Date().toISOString().slice(0, 10));
    const effectiveTo =
      typeof body.effectiveTo === 'string' && body.effectiveTo.trim()
        ? toWorkDateUtc(body.effectiveTo.trim())
        : null;

    const result = await ctx.run(async (tx) => {
      const staffIds = await listOrgStaffUserIds(tx, ctx.organizationId);
      if (!staffIds.includes(userId)) return { error: 'staff_not_found' as const };
      const policy = await tx.staffAttendancePolicy.findFirst({
        where: ctx.where({ id: policyId }),
        select: { id: true },
      });
      if (!policy) return { error: 'policy_not_found' as const };

      if (isPrimary) {
        await tx.staffAttendancePolicyAssignment.updateMany({
          where: ctx.where({ userId, isPrimary: true }),
          data: { isPrimary: false },
        });
      }

      const assignment = await tx.staffAttendancePolicyAssignment.create({
        data: {
          organizationId: ctx.organizationId,
          userId,
          staffAttendancePolicyId: policyId,
          effectiveFrom,
          effectiveTo,
          isPrimary,
        },
      });
      return { assignment };
    });

    if ('error' in result) {
      const message = result.error === 'policy_not_found' ? 'Policy not found.' : 'Staff member not found.';
      return NextResponse.json({ error: message }, { status: 404 });
    }

    await ctx.audit({
      action: 'staff_attendance.policy.assign',
      entityType: 'StaffAttendancePolicyAssignment',
      entityId: result.assignment.id,
      route: 'POST /api/staff/attendance/policies/assignments',
      metadata: { userId, policyId, isPrimary },
    });

    return NextResponse.json({ ok: true, id: result.assignment.id });
  });
}

/** DELETE /api/staff/attendance/policies/assignments?id=... — remove an assignment. */
export async function DELETE(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!staffUserCanManageAttendance(ctx.staff)) {
      return NextResponse.json({ error: 'Not allowed to assign policies.' }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get('id')?.trim() || '';
    if (!id) return NextResponse.json({ error: 'id required.' }, { status: 400 });

    const count = await ctx.run(async (tx) => {
      const res = await tx.staffAttendancePolicyAssignment.deleteMany({ where: ctx.where({ id }) });
      return res.count;
    });

    if (count === 0) return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 });

    await ctx.audit({
      action: 'staff_attendance.policy.unassign',
      entityType: 'StaffAttendancePolicyAssignment',
      entityId: id,
      route: 'DELETE /api/staff/attendance/policies/assignments',
    });

    return NextResponse.json({ ok: true });
  });
}
