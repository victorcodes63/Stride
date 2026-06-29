import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseAccountsPermissionsBody } from '@/lib/parse-accounts-permissions-body';
import {
  deleteGlobalAccountsAccessIfExists,
  setUserGlobalAccountsAccess,
} from '@/lib/set-global-accounts-access';
import { isStaffUserType } from '@/lib/staff-permissions';
import type { StaffUserType, UserRole } from '@/types/dashboard';
import { userRowToSummary } from '@/lib/user-summary-api';
import { logAuditEvent } from '@/lib/audit-events';
import { requireAdminOrganization, requireRecentSensitiveAuth } from '@/lib/admin-security';
import { updateOrganizationUser } from '@/lib/cell-org-users';
import { withOrgContext } from '@/lib/org-context';

const ROLES: UserRole[] = ['admin', 'staff', 'viewer'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminOrganization(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'User id required' }, { status: 400 });

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const membership = await withOrgContext(auth.organizationId, (tx) =>
      tx.organizationMembership.findUnique({
        where: {
          userId_organizationId: { userId: id, organizationId: auth.organizationId },
        },
        include: { user: true },
      }),
    );
    if (!membership) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json(
      await userRowToSummary(
        { ...membership.user, role: membership.role },
        {
          currentOrgId: auth.organizationId,
          currentOrgName: null,
          organizations: [{ id: auth.organizationId, name: '', role: membership.role }],
        },
      ),
    );
  } catch (e) {
    console.error('GET /api/users/[id] error:', e);
    return NextResponse.json({ error: 'Failed to load user.' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminOrganization(request);
  if (!auth.ok) return auth.response;
  const { actor, organizationId } = auth;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'User id required' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : undefined;
  const role = typeof b.role === 'string' ? (b.role as UserRole) : undefined;
  const isActive = typeof b.isActive === 'boolean' ? b.isActive : undefined;
  const password = typeof b.password === 'string' ? b.password : undefined;
  const staffUserType = typeof b.staffUserType === 'string' ? b.staffUserType : undefined;
  const mfaEnabled = typeof b.mfaEnabled === 'boolean' ? b.mfaEnabled : undefined;

  let accountsPatch: ReturnType<typeof parseAccountsPermissionsBody>;
  try {
    accountsPatch = parseAccountsPermissionsBody(b);
  } catch {
    return NextResponse.json({ error: 'Invalid accountsPermissions.' }, { status: 400 });
  }

  if (staffUserType !== undefined && !isStaffUserType(staffUserType)) {
    return NextResponse.json({ error: 'Invalid staff user type.' }, { status: 400 });
  }

  if (
    name === undefined &&
    role === undefined &&
    isActive === undefined &&
    password === undefined &&
    staffUserType === undefined &&
    mfaEnabled === undefined &&
    accountsPatch === undefined
  ) {
    return NextResponse.json({ error: 'Provide at least one field to update.' }, { status: 400 });
  }
  if (role !== undefined && !ROLES.includes(role)) {
    return NextResponse.json({ error: 'Role must be admin, staff, or viewer.' }, { status: 400 });
  }
  if (password !== undefined && password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    if (role !== undefined || password !== undefined || mfaEnabled !== undefined) {
      const reauthError = requireRecentSensitiveAuth(request, actor.userId || '');
      if (reauthError) return reauthError;
    }

    const before = await withOrgContext(organizationId, (tx) =>
      tx.organizationMembership.findUnique({
        where: {
          userId_organizationId: { userId: id, organizationId },
        },
        include: { user: { select: { role: true, isActive: true, staffUserType: true } } },
      }),
    );
    if (!before) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const updated = await updateOrganizationUser({
      organizationId,
      userId: id,
      ...(name !== undefined ? { name } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(password !== undefined ? { password } : {}),
      ...(role === 'admin' ? { makeCompanyAdmin: true } : {}),
    });

    if (staffUserType !== undefined || mfaEnabled !== undefined) {
      await withOrgContext(organizationId, (tx) =>
        tx.user.update({
          where: { id },
          data: {
            ...(staffUserType !== undefined ? { staffUserType } : {}),
            ...(mfaEnabled !== undefined
              ? { mfaEnabled, ...(mfaEnabled ? {} : { mfaSecret: null }) }
              : {}),
          },
        }),
      );
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    if (user.role === 'admin') {
      await deleteGlobalAccountsAccessIfExists(user.id, organizationId);
    } else if (accountsPatch !== undefined) {
      await setUserGlobalAccountsAccess(user.id, accountsPatch, organizationId);
    }

    await logAuditEvent({
      actor,
      action: password !== undefined ? 'user.credentials.changed' : 'user.updated',
      entityType: 'User',
      entityId: user.id,
      route: 'PATCH /api/users/[id]',
      metadata: {
        roleBefore: before.role,
        roleAfter: updated.role,
        isActiveBefore: before.user.isActive,
        isActiveAfter: user.isActive,
        staffUserTypeBefore: before.user.staffUserType,
        staffUserTypeAfter: user.staffUserType,
      },
      organizationId,
    });

    return NextResponse.json(
      await userRowToSummary(
        { ...user, role: updated.role },
        {
          currentOrgId: organizationId,
          currentOrgName: null,
          organizations: [{ id: organizationId, name: '', role: updated.role }],
        },
      ),
    );
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'P2025') return NextResponse.json({ error: 'User not found' }, { status: 404 });
    console.error('PATCH /api/users/[id] error:', e);
    return NextResponse.json({ error: 'Failed to update user.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminOrganization(request);
  if (!auth.ok) return auth.response;
  const { actor, organizationId } = auth;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'User id required' }, { status: 400 });

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const existing = await withOrgContext(organizationId, (tx) =>
      tx.organizationMembership.findUnique({
        where: {
          userId_organizationId: { userId: id, organizationId },
        },
        include: { user: { select: { email: true, role: true } } },
      }),
    );
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await withOrgContext(organizationId, async (tx) => {
      await tx.organizationMembership.update({
        where: { id: existing.id },
        data: { status: 'inactive', updatedAt: new Date() },
      });
      await tx.user.update({
        where: { id },
        data: { isActive: false, updatedAt: new Date() },
      });
    });

    await logAuditEvent({
      actor,
      action: 'user.deleted',
      entityType: 'User',
      entityId: id,
      route: 'DELETE /api/users/[id]',
      metadata: { email: existing.user.email, role: existing.role },
      organizationId,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'P2025') return NextResponse.json({ error: 'User not found' }, { status: 404 });
    console.error('DELETE /api/users/[id] error:', e);
    return NextResponse.json({ error: 'Failed to delete user.' }, { status: 500 });
  }
}
