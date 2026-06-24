import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getEssSessionMaxAgeSeconds } from '@/lib/ess-session';
import { logAuditEvent } from '@/lib/audit-events';
import { assertAccountLoginAllowed } from '@/lib/account-login-guard';

const ESS_SESSION_COOKIE = 'ess_session';
const COOKIE_MAX_AGE = getEssSessionMaxAgeSeconds();

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';

  if (!email || !password) {
    await logAuditEvent({
      actor: { userId: null, email: email || null, name: null },
      action: 'ess.login.failed',
      entityType: 'EssPortalUser',
      route: 'POST /api/ess/auth/login',
      metadata: { reason: 'missing_credentials' },
    });
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const accountBlocked = await assertAccountLoginAllowed(email);
  if (accountBlocked) return accountBlocked;

  const user = await prisma.essPortalUser.findUnique({ where: { email } });
  if (!user) {
    await logAuditEvent({
      actor: { userId: null, email, name: null },
      action: 'ess.login.failed',
      entityType: 'EssPortalUser',
      route: 'POST /api/ess/auth/login',
      metadata: { reason: 'user_not_found' },
    });
    return NextResponse.json({ error: 'No ESS account found with that email.' }, { status: 401 });
  }
  if (!user.isActive) {
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'ess.login.failed',
      entityType: 'EssPortalUser',
      entityId: user.id,
      route: 'POST /api/ess/auth/login',
      metadata: { reason: 'account_inactive' },
    });
    return NextResponse.json({ error: 'This ESS account is inactive.' }, { status: 403 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'ess.login.failed',
      entityType: 'EssPortalUser',
      entityId: user.id,
      route: 'POST /api/ess/auth/login',
      metadata: { reason: 'wrong_password' },
    });
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  await prisma.essPortalUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'ess.login.succeeded',
    entityType: 'EssPortalUser',
    entityId: user.id,
    route: 'POST /api/ess/auth/login',
    metadata: { role: user.role },
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set(ESS_SESSION_COOKIE, `local:${user.id}:${user.role}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
  return response;
}
