import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { staffUserCanManageAttendance } from '@/lib/staff-time-attendance/attendance-access';

const POLICY_MODES = ['biometric_primary', 'hybrid_override', 'manual_primary'] as const;
type PolicyMode = (typeof POLICY_MODES)[number];

function parseMode(value: unknown): PolicyMode {
  return POLICY_MODES.includes(value as PolicyMode) ? (value as PolicyMode) : 'hybrid_override';
}

function clampInt(value: unknown, fallback: number, min = 0, max = 100000): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** GET /api/staff/attendance/policies — list policies + assignment counts. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const data = await ctx.run(async (tx) => {
      const policies = await tx.staffAttendancePolicy.findMany({
        where: ctx.where(),
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        include: { _count: { select: { assignments: true } } },
      });

      const assignments = await tx.staffAttendancePolicyAssignment.findMany({
        where: ctx.where(),
        include: {
          user: { select: { id: true, name: true, email: true, department: true } },
          attendancePolicy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return { policies, assignments };
    });

    return NextResponse.json({
      policies: data.policies.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        mode: p.mode,
        graceInMinutes: p.graceInMinutes,
        graceOutMinutes: p.graceOutMinutes,
        minHalfDayMinutes: p.minHalfDayMinutes,
        fullDayMinutes: p.fullDayMinutes,
        requireManualApproval: p.requireManualApproval,
        mobileGeofenceEnabled: p.mobileGeofenceEnabled,
        rejectOutsideGeofence: p.rejectOutsideGeofence,
        isDefault: p.isDefault,
        isActive: p.isActive,
        assignedCount: p._count.assignments,
      })),
      assignments: data.assignments.map((a) => ({
        id: a.id,
        userId: a.userId,
        staffAttendancePolicyId: a.staffAttendancePolicyId,
        policyName: a.attendancePolicy?.name ?? null,
        effectiveFrom: a.effectiveFrom.toISOString().slice(0, 10),
        effectiveTo: a.effectiveTo ? a.effectiveTo.toISOString().slice(0, 10) : null,
        isPrimary: a.isPrimary,
        user: a.user
          ? { id: a.user.id, name: a.user.name, email: a.user.email, department: a.user.department }
          : null,
      })),
      canManage: staffUserCanManageAttendance(ctx.staff),
    });
  });
}

/** POST /api/staff/attendance/policies — create a policy. */
export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!staffUserCanManageAttendance(ctx.staff)) {
      return NextResponse.json({ error: 'Not allowed to manage policies.' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const isDefault = body.isDefault === true;

    const created = await ctx.run(async (tx) => {
      if (isDefault) {
        await tx.staffAttendancePolicy.updateMany({
          where: ctx.where({ isDefault: true }),
          data: { isDefault: false },
        });
      }
      return tx.staffAttendancePolicy.create({
        data: {
          organizationId: ctx.organizationId,
          name,
          description: typeof body.description === 'string' ? body.description.trim() || null : null,
          mode: parseMode(body.mode),
          graceInMinutes: clampInt(body.graceInMinutes, 0, 0, 240),
          graceOutMinutes: clampInt(body.graceOutMinutes, 0, 0, 240),
          minHalfDayMinutes: clampInt(body.minHalfDayMinutes, 240, 0, 1440),
          fullDayMinutes: clampInt(body.fullDayMinutes, 480, 0, 1440),
          requireManualApproval: body.requireManualApproval !== false,
          mobileGeofenceEnabled: body.mobileGeofenceEnabled === true,
          rejectOutsideGeofence: body.rejectOutsideGeofence !== false,
          isDefault,
          isActive: body.isActive !== false,
        },
      });
    });

    await ctx.audit({
      action: 'staff_attendance.policy.create',
      entityType: 'StaffAttendancePolicy',
      entityId: created.id,
      route: 'POST /api/staff/attendance/policies',
      metadata: { name, isDefault },
    });

    return NextResponse.json({ ok: true, id: created.id });
  });
}
