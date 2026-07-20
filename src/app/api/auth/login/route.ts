import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getStaffSessionMaxAgeSeconds } from '@/lib/auth-session';
import { reportApiError } from '@/lib/monitoring';
import { logAuditEvent } from '@/lib/audit-events';
import { createAuthChallengeToken } from '@/lib/auth-challenge';
import { assertAccountLoginAllowed } from '@/lib/account-login-guard';
import { buildStaffSessionForUser } from '@/lib/staff-session-issue';
import { NoOrgMembershipForLoginError } from '@/lib/org-membership';
import { assertCredentialsLoginEnabled } from '@/lib/oauth/assert-credentials-enabled';
import { resolveOrgByEmail } from '@/lib/auth/resolve-org-by-email';

const STAFF_SESSION_COOKIE = 'staff_session';
const COOKIE_MAX_AGE = getStaffSessionMaxAgeSeconds();

// Single message for every "bad credentials" outcome (unknown email, no
// password set, wrong password) so the response can't be used to enumerate
// which emails map to real accounts.
const GENERIC_LOGIN_ERROR = 'Incorrect email or password.';

// Lazily-computed bcrypt hash (cost 10, matching how staff passwords are
// stored) used only to equalize response timing on failed logins — without it,
// the missing-account path would skip bcrypt.compare and return noticeably
// faster, leaking account existence via latency.
let dummyPasswordHashPromise: Promise<string> | null = null;
function getDummyPasswordHash(): Promise<string> {
  if (!dummyPasswordHashPromise) {
    dummyPasswordHashPromise = bcrypt.hash('stride-timing-equalizer', 10);
  }
  return dummyPasswordHashPromise;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedPassword = typeof password === 'string' ? password : '';

    const credentialsBlocked = await assertCredentialsLoginEnabled('staff', normalizedEmail);
    if (credentialsBlocked) return credentialsBlocked;

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

    const resolved = await resolveOrgByEmail(normalizedEmail, 'staff');
    if (!resolved?.verifiedDomain || !resolved.credentialsAllowed) {
      const domainHint = resolved?.credentialsAllowed === false
        ? 'Password sign-in is disabled for your organization. Use SSO instead.'
        : 'Use an authorized work email domain to sign in.';
      await logAuditEvent({
        actor: { userId: null, email: normalizedEmail || null, name: null },
        action: 'auth.login.failed',
        entityType: 'User',
        route: 'POST /api/auth/login',
        metadata: { reason: 'unauthorized_domain' },
      });
      return NextResponse.json({ error: domainHint }, { status: 401 });
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

    // Always run a bcrypt comparison — against a dummy hash when the account or
    // its password is missing — so the timing of every failure path matches and
    // can't be used to tell whether an email belongs to a real account.
    const comparisonHash = user?.passwordHash || (await getDummyPasswordHash());
    const passwordMatches = await bcrypt.compare(normalizedPassword, comparisonHash);
    const passwordOk = Boolean(user?.passwordHash) && passwordMatches;

    if (!user || !passwordOk) {
      await logAuditEvent({
        actor: { userId: user?.id ?? null, email: normalizedEmail, name: user?.name ?? null },
        action: 'auth.login.failed',
        entityType: 'User',
        entityId: user?.id,
        route: 'POST /api/auth/login',
        metadata: {
          reason: !user ? 'user_not_found' : user.passwordHash ? 'wrong_password' : 'no_password_set',
        },
      });
      return NextResponse.json({ error: GENERIC_LOGIN_ERROR }, { status: 401 });
    }

    // Credentials are valid — only now is it safe to disclose an inactive
    // account, since a bare attacker without the password never reaches here.
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

    const sessionValue = await buildStaffSessionForUser({
      provider: 'local',
      userId: user.id,
      userRole: user.role,
      email: user.email,
    });
    const response = NextResponse.json({ success: true });
    response.cookies.set(STAFF_SESSION_COOKIE, sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
    return response;
  } catch (error) {
    if (error instanceof NoOrgMembershipForLoginError) {
      await logAuditEvent({
        actor: { userId: null, email: null, name: null },
        action: 'auth.login.failed',
        entityType: 'User',
        route: 'POST /api/auth/login',
        metadata: { reason: 'no_org_membership' },
      });
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
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
