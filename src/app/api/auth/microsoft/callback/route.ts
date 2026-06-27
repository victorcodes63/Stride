import { NextRequest, NextResponse } from 'next/server';
import { getStaffSessionMaxAgeSeconds } from '@/lib/auth-session';
import { completeStaffSsoLogin } from '@/lib/auth/sso-callback';
import { exchangeMicrosoftCodeForEmail } from '@/lib/oauth/microsoft-email';
import { getOAuthCookieDomain } from '@/lib/oauth-utils';
import { reportApiError } from '@/lib/monitoring';

const STAFF_SESSION_COOKIE = 'staff_session';
const STAFF_SESSION_MAX_AGE = getStaffSessionMaxAgeSeconds();
const OAUTH_STATE_COOKIE = 'staff_oauth_state';
const OAUTH_DEBUG = process.env.MS_OAUTH_DEBUG === 'true';

function logOAuthDebug(step: string, details: Record<string, unknown>) {
  if (!OAUTH_DEBUG) return;
  console.info(`[MS_OAUTH] ${step}`, details);
}

function denyToLogin(request: NextRequest, reason: string) {
  const denied = NextResponse.redirect(new URL(`/dashboard/login?error=${reason}`, request.url));
  const cookieDomain = getOAuthCookieDomain(request.url);
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
    ...(cookieDomain && { domain: cookieDomain }),
  };
  denied.cookies.set(OAUTH_STATE_COOKIE, '', cookieOpts);
  denied.cookies.set(STAFF_SESSION_COOKIE, '', cookieOpts);
  return denied;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const oauthError = request.nextUrl.searchParams.get('error');
  const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  const loginUrl = new URL('/dashboard/login', request.url);
  const dashboardUrl = new URL('/dashboard', request.url);

  if (oauthError) {
    loginUrl.searchParams.set('error', 'oauth');
    return NextResponse.redirect(loginUrl);
  }

  if (!code || !state || !stateCookie || state !== stateCookie) {
    loginUrl.searchParams.set('error', 'oauth');
    return NextResponse.redirect(loginUrl);
  }

  try {
    const profile = await exchangeMicrosoftCodeForEmail(code, 'staff');
    if ('error' in profile) {
      loginUrl.searchParams.set('error', 'oauth');
      return NextResponse.redirect(loginUrl);
    }

    logOAuthDebug('profile_resolved', { email: profile.email, tenantId: profile.tenantId });

    const result = await completeStaffSsoLogin({
      email: profile.email,
      provider: 'microsoft',
      microsoft: profile,
    });

    if (!result.ok) {
      return denyToLogin(request, result.reason === 'provider_disabled' ? 'oauth_disabled' : result.reason);
    }

    const response = NextResponse.redirect(dashboardUrl);
    const cookieDomain = getOAuthCookieDomain(request.url);
    response.cookies.set(STAFF_SESSION_COOKIE, result.sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: STAFF_SESSION_MAX_AGE,
      path: '/',
      ...(cookieDomain && { domain: cookieDomain }),
    });
    response.cookies.set(OAUTH_STATE_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
      ...(cookieDomain && { domain: cookieDomain }),
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await reportApiError({
      route: 'GET /api/auth/microsoft/callback',
      message,
    });
    loginUrl.searchParams.set('error', 'oauth');
    return NextResponse.redirect(loginUrl);
  }
}
