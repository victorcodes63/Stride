import { NextRequest, NextResponse } from 'next/server';
import { parseStaffProfileBody } from '@/lib/parse-staff-profile-body';
import { STAFF_USER_TYPE_LABELS } from '@/lib/staff-permissions';
import { withTenant, withTenantAudit } from '@/lib/tenant-api';
import type { StaffUserType } from '@/types/dashboard';

export const dynamic = 'force-dynamic';

const meSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  staffUserType: true,
  department: true,
  costCenterCode: true,
  costCenterName: true,
  monthlySalary: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  leaveApprover: { select: { id: true, name: true, email: true } },
} as const;

function serializeMe(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  staffUserType: string;
  department: string | null;
  costCenterCode: string | null;
  costCenterName: string | null;
  monthlySalary: { toNumber?: () => number } | number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  leaveApprover: { id: string; name: string; email: string } | null;
}) {
  const staffUserType = user.staffUserType as StaffUserType;
  const monthlySalary =
    user.monthlySalary == null
      ? null
      : typeof user.monthlySalary === 'number'
        ? user.monthlySalary
        : Number(user.monthlySalary);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    staffUserType,
    staffUserTypeLabel: STAFF_USER_TYPE_LABELS[staffUserType] ?? staffUserType,
    department: user.department,
    costCenterCode: user.costCenterCode,
    costCenterName: user.costCenterName,
    monthlySalary: Number.isFinite(monthlySalary) ? monthlySalary : null,
    leaveApprover: user.leaveApprover,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/** GET — signed-in staff member's own profile. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const user = await ctx.run((tx) =>
      tx.user.findUnique({
        where: { id: ctx.staff.id },
        select: meSelect,
      }),
    );
    if (!user) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }
    return NextResponse.json(serializeMe(user));
  });
}

/**
 * PATCH — self-serve updates for safe fields only (name, department, cost centres).
 * Monthly salary, role, leave approver, and staff type remain admin-managed.
 */
export async function PATCH(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const name =
      typeof body.name === 'string' ? body.name.trim() : undefined;
    if (name !== undefined && !name) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }

    // Self-serve must never change compensation — strip before parse so bad salary values don't 400.
    const { monthlySalary: _ignoredSalary, ...bodyWithoutSalary } = body;
    void _ignoredSalary;

    const profile = parseStaffProfileBody(bodyWithoutSalary);
    if (profile === 'invalid') {
      return NextResponse.json({ error: 'Invalid profile data.' }, { status: 400 });
    }

    if (name === undefined && Object.keys(profile).length === 0) {
      return NextResponse.json({ error: 'Provide at least one field to update.' }, { status: 400 });
    }

    const updated = await withTenantAudit(
      ctx,
      {
        action: 'people.me.updated',
        entityType: 'User',
        entityId: ctx.staff.id,
        route: 'PATCH /api/people/me',
        metadata: {
          fields: [
            ...(name !== undefined ? ['name'] : []),
            ...Object.keys(profile),
          ],
        },
      },
      (tx) =>
        tx.user.update({
          where: { id: ctx.staff.id },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...profile,
          },
          select: meSelect,
        }),
    );

    return NextResponse.json(serializeMe(updated));
  });
}
