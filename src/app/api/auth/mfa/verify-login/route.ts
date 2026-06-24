import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuthChallengeToken } from '@/lib/auth-challenge';
import { verifyTotpCode } from '@/lib/mfa-totp';
import { getStaffSessionMaxAgeSeconds } from '@/lib/auth-session';
import { logAuditEvent } from '@/lib/audit-events';

const STAFF_SESSION_COOKIE = 'staff_session';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const challenge = typeof body.challenge === 'string' ? body.challenge : '';
  const code = typeof body.code === 'string' ? body.code : '';
  if (!challenge || !code) {
    return NextResponse.json({ error: 'MFA challenge and code are required.' }, { status: 400 });
  }

  const payload = verifyAuthChallengeToken(challenge, 'login_mfa');
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired MFA challenge.' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'Account unavailable.' }, { status: 401 });
  }
  const secret = (user as { mfaSecret?: string | null }).mfaSecret;
  if (!(user as { mfaEnabled?: boolean }).mfaEnabled || !secret) {
    return NextResponse.json({ error: 'MFA is not enabled for this user.' }, { status: 400 });
  }
  if (!verifyTotpCode(secret, code)) {
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'auth.login.failed',
      entityType: 'User',
      entityId: user.id,
      route: 'POST /api/auth/mfa/verify-login',
      metadata: { reason: 'invalid_totp' },
    });
    return NextResponse.json({ error: 'Invalid MFA code.' }, { status: 401 });
  }

  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'auth.login.succeeded',
    entityType: 'User',
    entityId: user.id,
    route: 'POST /api/auth/mfa/verify-login',
    metadata: { mfa: true, role: user.role },
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => null);
  const response = NextResponse.json({ success: true });
  response.cookies.set(
    STAFF_SESSION_COOKIE,
    `local:${user.id}:${user.role}:${Math.floor(Date.now() / 1000)}`,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: getStaffSessionMaxAgeSeconds(),
      path: '/',
    },
  );
  return response;
}
