import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { parseAccountsPermissionsBody } from '@/lib/parse-accounts-permissions-body';
import { setUserGlobalAccountsAccess } from '@/lib/set-global-accounts-access';
import { isStaffUserType } from '@/lib/staff-permissions';
import type { StaffUserType, UserRole } from '@/types/dashboard';
import { userRowToSummary } from '@/lib/user-summary-api';
import { logAuditEvent } from '@/lib/audit-events';
import { requireAdminOrganization } from '@/lib/admin-security';
import { withOrgContext } from '@/lib/org-context';
import { createOrganizationUser } from '@/lib/cell-org-users';

const ROUNDS = 10;
const ROLES: UserRole[] = ['admin', 'staff', 'viewer'];

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrganization(request);
  if (!auth.ok) return auth.response;

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json([]);
    }
    const { searchParams } = new URL(request.url);
    const contractManagerPicker =
      searchParams.get('contractManagerPicker') === '1' || searchParams.get('picker') === 'contractManagers';

    const { organizationId } = auth;
    const memberships = await withOrgContext(organizationId, (tx) =>
      tx.organizationMembership.findMany({
        where: { organizationId, status: 'active' },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      }),
    );

    const org = await withOrgContext(organizationId, (tx) =>
      tx.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, slug: true },
      }),
    );
    const orgContext = {
      currentOrgId: organizationId,
      currentOrgName: org?.name ?? null,
      organizations: memberships.map((m) => ({
        id: organizationId,
        name: org?.name ?? '',
        slug: org?.slug ?? '',
        role: m.role as UserRole,
      })),
    };

    let list = memberships.map((m) => m.user);
    if (contractManagerPicker) {
      const seen = new Map<string, (typeof list)[0]>();
      for (const u of list) {
        const membership = memberships.find((m) => m.userId === u.id);
        const role = (membership?.role ?? u.role) as UserRole;
        const key = `${u.name.trim().toLowerCase()}|${role}`;
        if (!seen.has(key)) seen.set(key, u);
      }
      list = [...seen.values()];
    }

    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return NextResponse.json(
      await Promise.all(
        list.map(async (u) => {
          const membership = memberships.find((m) => m.userId === u.id);
          const summary = await userRowToSummary(
            {
              ...u,
              role: membership?.role ?? u.role,
            },
            orgContext,
          );
          return summary;
        }),
      ),
    );
  } catch (e) {
    console.error('GET /api/users error:', e);
    return NextResponse.json({ error: 'Failed to load users.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrganization(request);
  if (!auth.ok) return auth.response;
  const { actor, organizationId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const role = (typeof b.role === 'string' ? b.role : 'staff') as UserRole;
  const staffUserTypeRaw = typeof b.staffUserType === 'string' ? b.staffUserType : 'operations';
  const staffUserType: StaffUserType = isStaffUserType(staffUserTypeRaw)
    ? staffUserTypeRaw
    : 'operations';

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: 'Role must be admin, staff, or viewer.' }, { status: 400 });
  }
  if (typeof b.staffUserType === 'string' && !isStaffUserType(b.staffUserType)) {
    return NextResponse.json({ error: 'Invalid staff user type.' }, { status: 400 });
  }

  let accountsPatch: ReturnType<typeof parseAccountsPermissionsBody>;
  try {
    accountsPatch = parseAccountsPermissionsBody(b);
  } catch {
    return NextResponse.json({ error: 'Invalid accountsPermissions.' }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const created = await createOrganizationUser({
      organizationId,
      email,
      name,
      password,
      role,
    });

    if (staffUserType !== 'operations') {
      await withOrgContext(organizationId, (tx) =>
        tx.user.update({
          where: { id: created.userId },
          data: { staffUserType },
        }),
      );
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: created.userId } });
    if (role !== 'admin' && accountsPatch) {
      await setUserGlobalAccountsAccess(user.id, accountsPatch, organizationId);
    }
    await logAuditEvent({
      actor,
      action: 'user.created',
      entityType: 'User',
      entityId: user.id,
      route: 'POST /api/users',
      metadata: { role: created.role, staffUserType: user.staffUserType },
      organizationId,
    });
    try {
      const { sendAccountInviteEmail } = await import('@/lib/email');
      await sendAccountInviteEmail({
        to: user.email,
        name: user.name ?? '',
        portal: 'staff',
        userId: user.id,
      });
    } catch (err) {
      console.error('[notifications] Failed to send user_invited:', err);
    }
    return NextResponse.json(
      await userRowToSummary(
        { ...user, role: created.role },
        {
          currentOrgId: organizationId,
          currentOrgName: null,
          organizations: [{ id: organizationId, name: '', role: created.role }],
        },
      ),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create user.';
    if (message.includes('already exists') || message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
    }
    console.error('POST /api/users error:', e);
    return NextResponse.json({ error: 'Failed to create user.' }, { status: 500 });
  }
}
