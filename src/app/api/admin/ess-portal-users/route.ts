import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAdminOrganization } from '@/lib/admin-security';
import { logAuditEvent } from '@/lib/audit-events';
import { withOrgContext } from '@/lib/org-context';

const ROUNDS = 10;
const ESS_ROLES = ['employee', 'manager', 'hr'] as const;

function mapEssPortalUser(
  u: {
    id: string;
    employeeId: string | null;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    mustResetPassword: boolean;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    employee: {
      firstName: string;
      lastName: string;
      employeeNumber: string | null;
      department: { name: string } | null;
    } | null;
    createdByUser: { name: string | null } | null;
  },
) {
  return {
    id: u.id,
    employeeId: u.employeeId,
    employeeName: u.employee ? `${u.employee.firstName} ${u.employee.lastName}`.trim() : null,
    employeeNumber: u.employee?.employeeNumber ?? null,
    department: u.employee?.department?.name ?? null,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    mustResetPassword: u.mustResetPassword,
    notes: u.notes,
    createdByName: u.createdByUser?.name ?? null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

const essUserInclude = {
  employee: {
    select: {
      firstName: true,
      lastName: true,
      employeeNumber: true,
      department: { select: { name: true } },
    },
  },
  createdByUser: { select: { name: true } },
} as const;

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrganization(request);
  if (!auth.ok) return auth.response;

  try {
    if (!process.env.DATABASE_URL) return NextResponse.json([]);
    const users = await withOrgContext(auth.organizationId, (tx) =>
      tx.essPortalUser.findMany({
        where: { organizationId: auth.organizationId },
        orderBy: { createdAt: 'desc' },
        include: essUserInclude,
      }),
    );
    return NextResponse.json(users.map(mapEssPortalUser));
  } catch (e) {
    console.error('GET /api/admin/ess-portal-users error:', e);
    return NextResponse.json({ error: 'Failed to load ESS users.' }, { status: 500 });
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
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const role = typeof b.role === 'string' ? b.role : 'employee';
  const notes = typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim() : null;
  const employeeId = typeof b.employeeId === 'string' && b.employeeId.trim() ? b.employeeId.trim() : null;
  const mustResetPassword = typeof b.mustResetPassword === 'boolean' ? b.mustResetPassword : true;

  if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
  }
  if (!ESS_ROLES.includes(role as (typeof ESS_ROLES)[number])) {
    return NextResponse.json({ error: 'Invalid ESS role.' }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const user = await withOrgContext(organizationId, async (tx) => {
      const existing = await tx.essPortalUser.findFirst({
        where: { organizationId, email },
      });
      if (existing) {
        throw Object.assign(new Error('ESS user with this email already exists.'), { status: 409 });
      }

      if (employeeId) {
        const employee = await tx.employee.findFirst({
          where: { id: employeeId, organizationId },
          select: { id: true },
        });
        if (!employee) {
          throw Object.assign(new Error('Employee not found for ESS account.'), { status: 404 });
        }
      }

      return tx.essPortalUser.create({
        data: {
          organizationId,
          email,
          name,
          role: role as 'employee' | 'manager' | 'hr',
          employeeId,
          notes,
          mustResetPassword,
          passwordHash: await bcrypt.hash(password, ROUNDS),
          createdByUserId: actor?.userId ?? null,
        },
        include: essUserInclude,
      });
    });

    await logAuditEvent({
      actor,
      action: 'ess_user.created',
      entityType: 'EssPortalUser',
      entityId: user.id,
      route: '/api/admin/ess-portal-users',
      metadata: { email: user.email, role: user.role },
    });

    try {
      const { sendAccountInviteEmail } = await import('@/lib/email');
      await sendAccountInviteEmail({
        to: user.email,
        name: user.name ?? '',
        portal: 'ess',
        userId: user.id,
      });
    } catch (err) {
      console.error('[ess-portal-users] Failed to send invite email:', err);
    }

    return NextResponse.json(mapEssPortalUser(user));
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.status === 409) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err.status === 404) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error('POST /api/admin/ess-portal-users error:', e);
    return NextResponse.json({ error: 'Failed to create ESS user.' }, { status: 500 });
  }
}
