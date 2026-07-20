import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { staffUserCanManageAttendance } from '@/lib/staff-time-attendance/attendance-access';

const POLICY_MODES = ['biometric_primary', 'hybrid_override', 'manual_primary'] as const;
type PolicyMode = (typeof POLICY_MODES)[number];

function clampInt(value: unknown, min = 0, max = 1440): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (Number.isNaN(n)) return undefined;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** PATCH /api/staff/attendance/policies/[id] — update a policy. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!staffUserCanManageAttendance(ctx.staff)) {
      return NextResponse.json({ error: 'Not allowed to manage policies.' }, { status: 403 });
    }

    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (typeof body.description === 'string') data.description = body.description.trim() || null;
    if (POLICY_MODES.includes(body.mode as PolicyMode)) data.mode = body.mode;
    const graceIn = clampInt(body.graceInMinutes, 0, 240);
    if (graceIn !== undefined) data.graceInMinutes = graceIn;
    const graceOut = clampInt(body.graceOutMinutes, 0, 240);
    if (graceOut !== undefined) data.graceOutMinutes = graceOut;
    const halfDay = clampInt(body.minHalfDayMinutes);
    if (halfDay !== undefined) data.minHalfDayMinutes = halfDay;
    const fullDay = clampInt(body.fullDayMinutes);
    if (fullDay !== undefined) data.fullDayMinutes = fullDay;
    if (typeof body.requireManualApproval === 'boolean') data.requireManualApproval = body.requireManualApproval;
    if (typeof body.mobileGeofenceEnabled === 'boolean') data.mobileGeofenceEnabled = body.mobileGeofenceEnabled;
    if (typeof body.rejectOutsideGeofence === 'boolean') data.rejectOutsideGeofence = body.rejectOutsideGeofence;
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;

    const result = await ctx.run(async (tx) => {
      const existing = await tx.staffAttendancePolicy.findFirst({ where: ctx.where({ id }), select: { id: true } });
      if (!existing) return { error: 'not_found' as const };

      if (body.isDefault === true) {
        await tx.staffAttendancePolicy.updateMany({
          where: ctx.where({ isDefault: true, id: { not: id } }),
          data: { isDefault: false },
        });
        data.isDefault = true;
      } else if (body.isDefault === false) {
        data.isDefault = false;
      }

      return { policy: await tx.staffAttendancePolicy.update({ where: { id }, data }) };
    });

    if ('error' in result) return NextResponse.json({ error: 'Policy not found.' }, { status: 404 });

    await ctx.audit({
      action: 'staff_attendance.policy.update',
      entityType: 'StaffAttendancePolicy',
      entityId: id,
      route: 'PATCH /api/staff/attendance/policies/[id]',
      metadata: { fields: Object.keys(data) },
    });

    return NextResponse.json({ ok: true });
  });
}

/** DELETE /api/staff/attendance/policies/[id] — remove a policy (and its assignments). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!staffUserCanManageAttendance(ctx.staff)) {
      return NextResponse.json({ error: 'Not allowed to manage policies.' }, { status: 403 });
    }

    const { id } = await params;
    const result = await ctx.run(async (tx) => {
      const existing = await tx.staffAttendancePolicy.findFirst({ where: ctx.where({ id }), select: { id: true } });
      if (!existing) return { error: 'not_found' as const };
      await tx.staffAttendancePolicyAssignment.deleteMany({ where: ctx.where({ staffAttendancePolicyId: id }) });
      await tx.staffAttendancePolicy.delete({ where: { id } });
      return { ok: true as const };
    });

    if ('error' in result) return NextResponse.json({ error: 'Policy not found.' }, { status: 404 });

    await ctx.audit({
      action: 'staff_attendance.policy.delete',
      entityType: 'StaffAttendancePolicy',
      entityId: id,
      route: 'DELETE /api/staff/attendance/policies/[id]',
    });

    return NextResponse.json({ ok: true });
  });
}
