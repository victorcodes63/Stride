import { NextRequest, NextResponse } from 'next/server';
import { parseStaffSession } from '@/lib/auth-session';
import { prisma } from '@/lib/prisma';

export type AdminActor = {
  userId: string | null;
  email: string | null;
  name: string | null;
};

export const SENSITIVE_AUTH_COOKIE = 'staff_sensitive_auth';
const SENSITIVE_AUTH_WINDOW_SECONDS = 10 * 60;

export class SodViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SodViolationError';
  }
}

export async function requireAdminActor(
  request: NextRequest,
): Promise<{ error: NextResponse | null; actor: AdminActor | null }> {
  const rawSession = request.cookies.get('staff_session')?.value;
  if (!rawSession) {
    return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }), actor: null };
  }

  const parsed = parseStaffSession(rawSession);
  if (!process.env.DATABASE_URL) {
    if (parsed.role === 'admin') {
      return {
        error: null,
        actor: { userId: parsed.userId ?? null, email: parsed.email ?? null, name: 'Admin' },
      };
    }
    return { error: NextResponse.json({ error: 'Only admins can perform this action.' }, { status: 403 }), actor: null };
  }

  let currentUser = null as Awaited<ReturnType<typeof prisma.user.findUnique>> | null;
  if (parsed.userId) {
    currentUser = await prisma.user.findUnique({ where: { id: parsed.userId } });
  }
  if (!currentUser && parsed.email) {
    currentUser = await prisma.user.findUnique({ where: { email: parsed.email.toLowerCase() } });
  }
  if (!currentUser) {
    return { error: NextResponse.json({ error: 'No staff account found for this session.' }, { status: 401 }), actor: null };
  }
  if (!currentUser.isActive) {
    return { error: NextResponse.json({ error: 'Your account is inactive. Contact an administrator.' }, { status: 403 }), actor: null };
  }
  if (currentUser.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Only admins can perform this action.' }, { status: 403 }), actor: null };
  }

  return {
    error: null,
    actor: { userId: currentUser.id, email: currentUser.email, name: currentUser.name },
  };
}

export function markSensitiveAuthCookie(response: NextResponse, userId: string) {
  response.cookies.set(SENSITIVE_AUTH_COOKIE, `${userId}:${Math.floor(Date.now() / 1000)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SENSITIVE_AUTH_WINDOW_SECONDS,
    path: '/',
  });
}

export function requireRecentSensitiveAuth(
  request: NextRequest,
  userId: string,
): NextResponse | null {
  const raw = request.cookies.get(SENSITIVE_AUTH_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json(
      { error: 'Sensitive action requires recent re-authentication.' },
      { status: 401 },
    );
  }
  const [cookieUserId, tsRaw] = raw.split(':');
  const issuedAt = Number(tsRaw);
  if (!cookieUserId || cookieUserId !== userId || !Number.isFinite(issuedAt)) {
    return NextResponse.json(
      { error: 'Sensitive action requires recent re-authentication.' },
      { status: 401 },
    );
  }
  if (Math.floor(Date.now() / 1000) - issuedAt > SENSITIVE_AUTH_WINDOW_SECONDS) {
    return NextResponse.json(
      { error: 'Sensitive re-authentication has expired. Please verify again.' },
      { status: 401 },
    );
  }
  return null;
}

export async function enforceSodCheck(input: {
  actorUserId: string;
  entityType: string;
  entityId: string;
  forbiddenActions: string[];
  actionLabel: string;
}): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new SodViolationError('SoD check failed closed: database unavailable.');
  }
  const priorConflict = await prisma.auditEvent.findFirst({
    where: {
      actorUserId: input.actorUserId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: { in: input.forbiddenActions },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (priorConflict) {
    throw new SodViolationError(
      `SoD policy blocks ${input.actionLabel}: action conflicts with ${priorConflict.action}.`,
    );
  }
}
