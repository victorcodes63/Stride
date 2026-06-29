import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAdminOrganization } from '@/lib/admin-security';
import { logAuditEvent } from '@/lib/audit-events';
import { withOrgContext } from '@/lib/org-context';

const ROUNDS = 10;
const ESS_ROLES = ['employee', 'manager', 'hr'] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminOrganization(request);
  if (!auth.ok) return auth.response;
  const { actor, organizationId } = auth;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ESS user id is required.' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const data: {
    name?: string;
    role?: 'employee' | 'manager' | 'hr';
    isActive?: boolean;
    employeeId?: string | null;
    notes?: string | null;
    mustResetPassword?: boolean;
    passwordHash?: string;
  } = {};

  if (typeof b.name === 'string') data.name = b.name.trim();
  if (typeof b.role === 'string') {
    if (!ESS_ROLES.includes(b.role as (typeof ESS_ROLES)[number])) {
      return NextResponse.json({ error: 'Invalid ESS role.' }, { status: 400 });
    }
    data.role = b.role as 'employee' | 'manager' | 'hr';
  }
  if (typeof b.isActive === 'boolean') data.isActive = b.isActive;
  if (typeof b.mustResetPassword === 'boolean') data.mustResetPassword = b.mustResetPassword;
  if (typeof b.employeeId === 'string') data.employeeId = b.employeeId.trim() || null;
  if (b.employeeId === null) data.employeeId = null;
  if (typeof b.notes === 'string') data.notes = b.notes.trim() || null;
  if (b.notes === null) data.notes = null;
  if (typeof b.password === 'string' && b.password.trim()) {
    if (b.password.trim().length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(b.password.trim(), ROUNDS);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Provide at least one field to update.' }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const user = await withOrgContext(organizationId, async (tx) => {
      const existing = await tx.essPortalUser.findFirst({
        where: { id, organizationId },
        select: { id: true },
      });
      if (!existing) return null;

      return tx.essPortalUser.update({
        where: { id },
        data,
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeNumber: true,
              department: { select: { name: true } },
            },
          },
          createdByUser: { select: { name: true } },
        },
      });
    });

    if (!user) {
      return NextResponse.json({ error: 'ESS user not found.' }, { status: 404 });
    }

    await logAuditEvent({
      actor,
      action: 'ess_user.updated',
      entityType: 'EssPortalUser',
      entityId: user.id,
      route: '/api/admin/ess-portal-users/[id]',
      metadata: { updatedFields: Object.keys(data) },
    });

    return NextResponse.json({
      id: user.id,
      employeeId: user.employeeId,
      employeeName: user.employee ? `${user.employee.firstName} ${user.employee.lastName}`.trim() : null,
      employeeNumber: user.employee?.employeeNumber ?? null,
      department: user.employee?.department?.name ?? null,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      mustResetPassword: user.mustResetPassword,
      notes: user.notes,
      createdByName: user.createdByUser?.name ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error('PATCH /api/admin/ess-portal-users/[id] error:', e);
    return NextResponse.json({ error: 'Failed to update ESS user.' }, { status: 500 });
  }
}
