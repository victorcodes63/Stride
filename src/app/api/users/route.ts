import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { parseStaffSession } from '@/lib/auth-session';
import { parseAccountsPermissionsBody } from '@/lib/parse-accounts-permissions-body';
import { setUserGlobalAccountsAccess } from '@/lib/set-global-accounts-access';
import { isStaffUserType } from '@/lib/staff-permissions';
import type { StaffUserType, UserRole } from '@/types/dashboard';
import { userRowToSummary } from '@/lib/user-summary-api';
import { logAuditEvent } from '@/lib/audit-events';
import { sendNotification } from '@/lib/notifications';
import { brand } from '@/lib/brand';

const ROUNDS = 10;
const ROLES: UserRole[] = ['admin', 'staff', 'viewer'];

function actorFromRequest(request: NextRequest) {
  const parsed = parseStaffSession(request.cookies.get('staff_session')?.value ?? '');
  return {
    userId: parsed.userId ?? null,
    email: parsed.email ?? null,
    name: null,
  };
}

async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const rawSession = request.cookies.get('staff_session')?.value;
  if (!rawSession) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const parsed = parseStaffSession(rawSession);
  if (!process.env.DATABASE_URL) {
    if (parsed.role === 'admin') return null;
    return NextResponse.json({ error: 'Only admins can manage staff and roles.' }, { status: 403 });
  }

  let currentUser = null as Awaited<ReturnType<typeof prisma.user.findUnique>> | null;
  if (parsed.userId) {
    currentUser = await prisma.user.findUnique({ where: { id: parsed.userId } });
  }
  if (!currentUser && parsed.email) {
    currentUser = await prisma.user.findUnique({ where: { email: parsed.email.toLowerCase() } });
  }

  if (!currentUser) {
    return NextResponse.json({ error: 'No staff account found for this session.' }, { status: 401 });
  }
  if (!currentUser.isActive) {
    return NextResponse.json({ error: 'Your account is inactive. Contact an administrator.' }, { status: 403 });
  }
  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can manage staff and roles.' }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json([]);
    }
    const { searchParams } = new URL(request.url);
    const contractManagerPicker =
      searchParams.get('contractManagerPicker') === '1' || searchParams.get('picker') === 'contractManagers';

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });

    let list = users;
    if (contractManagerPicker) {
      const seen = new Map<string, (typeof users)[0]>();
      for (const u of users) {
        const key = `${u.name.trim().toLowerCase()}|${u.role}`;
        if (!seen.has(key)) seen.set(key, u);
      }
      list = [...seen.values()];
    }

    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return NextResponse.json(await Promise.all(list.map((u) => userRowToSummary(u))));
  } catch (e) {
    console.error('GET /api/users error:', e);
    return NextResponse.json({ error: 'Failed to load users.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminError = await requireAdmin(request);
  if (adminError) return adminError;
  const actor = actorFromRequest(request);

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

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, ROUNDS);
    const user = await prisma.user.create({
      data: { email, name, passwordHash, role, staffUserType },
    });
    if (role !== 'admin' && accountsPatch) {
      await setUserGlobalAccountsAccess(user.id, accountsPatch);
    }
    await logAuditEvent({
      actor,
      action: 'user.created',
      entityType: 'User',
      entityId: user.id,
      route: 'POST /api/users',
      metadata: { role: user.role, staffUserType: user.staffUserType },
    });
    try {
      await sendNotification({
        event: 'user_invited',
        recipientUserIds: [user.id],
        title: `Welcome to ${brand.appName}`,
        body: `An account has been created for you. Log in with ${user.email}.`,
        href: '/dashboard/login',
        priority: 'info',
        channel: 'email',
        metadata: {
          email: user.email,
          loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || ''}/dashboard/login`,
        },
      });
    } catch (err) {
      console.error('[notifications] Failed to send user_invited:', err);
    }
    return NextResponse.json(await userRowToSummary(user));
  } catch (e) {
    console.error('POST /api/users error:', e);
    return NextResponse.json({ error: 'Failed to create user.' }, { status: 500 });
  }
}
