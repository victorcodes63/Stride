import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getStaffSessionMaxAgeSeconds } from '@/lib/auth-session';
import { reportApiError } from '@/lib/monitoring';
import { logAuditEvent } from '@/lib/audit-events';
import { getStaffAllowedDomains, isStaffEmailDomainAllowed } from '@/lib/staff-allowed-domains';
import { createAuthChallengeToken } from '@/lib/auth-challenge';
import { assertAccountLoginAllowed } from '@/lib/account-login-guard';

const STAFF_SESSION_COOKIE = 'staff_session';
const COOKIE_MAX_AGE = getStaffSessionMaxAgeSeconds();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedPassword = typeof password === 'string' ? password : '';

    const staffEmail = process.env.STAFF_EMAIL;
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'Database not configured for staff login.' },
        { status: 503 }
      );
    }

    if (!normalizedEmail || !normalizedPassword) {
      await logAuditEvent({
        actor: { userId: null, email: normalizedEmail || null, name: null },
        action: 'auth.login.failed',
        entityType: 'User',
        route: 'POST /api/auth/login',
        metadata: { reason: 'missing_credentials' },
      });
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const allowedDomains = getStaffAllowedDomains();
    const domainOk = isStaffEmailDomainAllowed(normalizedEmail, allowedDomains);
    if (!domainOk) {
      const domainHint =
        allowedDomains.length === 1
          ? `Use your @${allowedDomains[0]} email to sign in.`
          : 'Use an authorized staff email domain to sign in.';
      await logAuditEvent({
        actor: { userId: null, email: normalizedEmail || null, name: null },
        action: 'auth.login.failed',
        entityType: 'User',
        route: 'POST /api/auth/login',
        metadata: { reason: 'unauthorized_domain' },
      });
      return NextResponse.json(
        { error: domainHint },
        { status: 401 }
      );
    }

    if (staffEmail && normalizedEmail !== staffEmail.toLowerCase()) {
      await logAuditEvent({
        actor: { userId: null, email: normalizedEmail, name: null },
        action: 'auth.login.failed',
        entityType: 'User',
        route: 'POST /api/auth/login',
        metadata: { reason: 'email_not_authorized' },
      });
      return NextResponse.json(
        { error: 'This email is not authorized for dashboard access.' },
        { status: 401 }
      );
    }

    const accountBlocked = await assertAccountLoginAllowed(normalizedEmail);
    if (accountBlocked) return accountBlocked;

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) {
      await logAuditEvent({
        actor: { userId: null, email: normalizedEmail, name: null },
        action: 'auth.login.failed',
        entityType: 'User',
        route: 'POST /api/auth/login',
        metadata: { reason: 'user_not_found' },
      });
      return NextResponse.json(
        { error: 'No staff account found for this email. Ask an admin to add you.' },
        { status: 401 }
      );
    }
    if (!user.isActive) {
      await logAuditEvent({
        actor: { userId: user.id, email: user.email, name: user.name },
        action: 'auth.login.failed',
        entityType: 'User',
        entityId: user.id,
        route: 'POST /api/auth/login',
        metadata: { reason: 'account_inactive' },
      });
      return NextResponse.json(
        { error: 'Your account is inactive. Contact an administrator.' },
        { status: 403 }
      );
    }
    const passwordOk = await bcrypt.compare(normalizedPassword, user.passwordHash);
    if (!passwordOk) {
      await logAuditEvent({
        actor: { userId: user.id, email: user.email, name: user.name },
        action: 'auth.login.failed',
        entityType: 'User',
        entityId: user.id,
        route: 'POST /api/auth/login',
        metadata: { reason: 'wrong_password' },
      });
      return NextResponse.json(
        { error: 'Incorrect password. Please try again.' },
        { status: 401 }
      );
    }
    const mfaEnabled = Boolean((user as { mfaEnabled?: boolean }).mfaEnabled);
    if (mfaEnabled) {
      const challenge = createAuthChallengeToken({
        userId: user.id,
        email: user.email,
        purpose: 'login_mfa',
        exp: Math.floor(Date.now() / 1000) + 5 * 60,
      });
      await logAuditEvent({
        actor: { userId: user.id, email: user.email, name: user.name },
        action: 'auth.login.mfa_challenge',
        entityType: 'User',
        entityId: user.id,
        route: 'POST /api/auth/login',
        metadata: { role: user.role },
      });
      return NextResponse.json({ success: false, mfaRequired: true, challenge });
    }
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'auth.login.succeeded',
      entityType: 'User',
      entityId: user.id,
      route: 'POST /api/auth/login',
      metadata: { role: user.role },
    });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => null);

    const response = NextResponse.json({ success: true });
    response.cookies.set(STAFF_SESSION_COOKIE, `local:${user.id}:${user.role}:${Math.floor(Date.now() / 1000)}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
    return response;
  } catch (error) {
    await reportApiError({
      route: 'POST /api/auth/login',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Unable to sign in right now. Please try again.' },
      { status: 500 }
    );
  }
}
