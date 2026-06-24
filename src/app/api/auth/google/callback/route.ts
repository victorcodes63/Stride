import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStaffSessionMaxAgeSeconds } from '@/lib/auth-session';
import { reportApiError } from '@/lib/monitoring';
import { getStaffAllowedDomains, isStaffEmailDomainAllowed } from '@/lib/staff-allowed-domains';

const STAFF_SESSION_COOKIE = 'staff_session';
const STAFF_SESSION_MAX_AGE = getStaffSessionMaxAgeSeconds();
const OAUTH_STATE_COOKIE = 'staff_oauth_state_google';
const OAUTH_DEBUG = process.env.GOOGLE_OAUTH_DEBUG === 'true';

function getCookieDomain(requestUrl: string): string | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined;
  const host = new URL(requestUrl).hostname.toLowerCase();
  if (host === 'example.com' || host === 'www.example.com') return '.example.com';
  return undefined;
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    return process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/$/, '')}`;
  }
  return 'http://localhost:3000';
}

function getRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || `${getBaseUrl()}/api/auth/google/callback`;
}

function normalizeEmailDomain(email: string) {
  return email.trim().toLowerCase();
}

function isAllowedEmail(email: string) {
  return isStaffEmailDomainAllowed(email);
}

function logOAuthDebug(step: string, details: Record<string, unknown>) {
  if (!OAUTH_DEBUG) return;
  console.info(`[GOOGLE_OAUTH] ${step}`, details);
}

function denyToLogin(request: NextRequest, reason: string) {
  const denied = NextResponse.redirect(new URL(`/dashboard/login?error=${reason}`, request.url));
  const cookieDomain = getCookieDomain(request.url);
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
  const oauthErrorDescription = request.nextUrl.searchParams.get('error_description');
  const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  const loginUrl = new URL('/dashboard/login', request.url);
  const dashboardUrl = new URL('/dashboard', request.url);

  logOAuthDebug('callback_received', {
    hasCode: Boolean(code),
    hasState: Boolean(state),
    hasStateCookie: Boolean(stateCookie),
    oauthError,
    oauthErrorDescription: oauthErrorDescription ? oauthErrorDescription.slice(0, 180) : null,
  });

  if (oauthError) {
    loginUrl.searchParams.set('error', 'oauth');
    logOAuthDebug('provider_returned_error', {
      oauthError,
      oauthErrorDescription: oauthErrorDescription ? oauthErrorDescription.slice(0, 300) : null,
    });
    return NextResponse.redirect(loginUrl);
  }

  if (!code || !state || !stateCookie || state !== stateCookie) {
    logOAuthDebug('state_validation_failed', {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasStateCookie: Boolean(stateCookie),
      stateMatches: Boolean(state && stateCookie && state === stateCookie),
    });
    loginUrl.searchParams.set('error', 'oauth');
    return NextResponse.redirect(loginUrl);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    logOAuthDebug('missing_oauth_env', {
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
      redirectUri: getRedirectUri(),
    });
    loginUrl.searchParams.set('error', 'oauth');
    return NextResponse.redirect(loginUrl);
  }

  try {
    logOAuthDebug('token_exchange_start', {
      redirectUri: getRedirectUri(),
      codeLength: code.length,
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: getRedirectUri(),
      }).toString(),
    });

    if (!tokenRes.ok) {
      const tokenErrorText = await tokenRes.text().catch(() => '');
      logOAuthDebug('token_exchange_failed', {
        status: tokenRes.status,
        body: tokenErrorText.slice(0, 500),
      });
      if (!OAUTH_DEBUG) {
        console.warn('[GOOGLE_OAUTH] token exchange failed', { status: tokenRes.status });
      }
      await reportApiError({
        route: 'GET /api/auth/google/callback',
        status: tokenRes.status,
        message: 'Google token exchange failed.',
      });
      loginUrl.searchParams.set('error', 'oauth');
      return NextResponse.redirect(loginUrl);
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      logOAuthDebug('token_missing_access_token', {
        tokenResponseKeys: Object.keys(tokenData || {}),
      });
      loginUrl.searchParams.set('error', 'oauth');
      return NextResponse.redirect(loginUrl);
    }

    const meRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });

    if (!meRes.ok) {
      const meErrorText = await meRes.text().catch(() => '');
      logOAuthDebug('userinfo_failed', {
        status: meRes.status,
        body: meErrorText.slice(0, 500),
      });
      if (!OAUTH_DEBUG) {
        console.warn('[GOOGLE_OAUTH] userinfo failed', { status: meRes.status });
      }
      await reportApiError({
        route: 'GET /api/auth/google/callback',
        status: meRes.status,
        message: 'Google profile lookup failed.',
      });
      loginUrl.searchParams.set('error', 'oauth');
      return NextResponse.redirect(loginUrl);
    }

    const me = (await meRes.json()) as { email?: string | null; email_verified?: boolean };
    const email = normalizeEmailDomain(me.email || '');
    logOAuthDebug('userinfo_success', {
      resolvedEmail: email,
      allowedDomains: getStaffAllowedDomains(),
    });

    if (!email || !isAllowedEmail(email)) {
      logOAuthDebug('domain_rejected', {
        resolvedEmail: email || null,
        allowedDomains: getStaffAllowedDomains(),
      });
      return denyToLogin(request, 'domain');
    }

    if (!process.env.DATABASE_URL) {
      logOAuthDebug('db_not_configured_for_staff_allowlist', {});
      return denyToLogin(request, 'oauth');
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, isActive: true, email: true },
    });
    if (!user) {
      logOAuthDebug('user_not_found_in_allowlist', { email });
      return denyToLogin(request, 'no_account');
    }
    if (!user.isActive) {
      logOAuthDebug('user_inactive', { email: user.email, userId: user.id });
      return denyToLogin(request, 'inactive');
    }
    logOAuthDebug('login_success', { resolvedEmail: email, userId: user.id, role: user.role });
    const response = NextResponse.redirect(dashboardUrl);
    const cookieDomain = getCookieDomain(request.url);
    response.cookies.set(STAFF_SESSION_COOKIE, `google:${user.id}:${user.role}:${email}`, {
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
    logOAuthDebug('callback_exception', { message });
    console.error('[GOOGLE_OAUTH] callback exception', { message });
    await reportApiError({
      route: 'GET /api/auth/google/callback',
      message,
    });
    loginUrl.searchParams.set('error', 'oauth');
    return NextResponse.redirect(loginUrl);
  }
}
