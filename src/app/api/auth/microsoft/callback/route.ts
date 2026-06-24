import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStaffSessionMaxAgeSeconds } from '@/lib/auth-session';
import { reportApiError } from '@/lib/monitoring';
import { getStaffAllowedDomains, isStaffEmailDomainAllowed } from '@/lib/staff-allowed-domains';

const STAFF_SESSION_COOKIE = 'staff_session';
const STAFF_SESSION_MAX_AGE = getStaffSessionMaxAgeSeconds();
const OAUTH_STATE_COOKIE = 'staff_oauth_state';
const OAUTH_DEBUG = process.env.MS_OAUTH_DEBUG === 'true';

/** Cookie domain so state/session work when start is on www and callback on apex (or vice versa). */
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
  return (
    process.env.MS_REDIRECT_URI?.trim() ||
    `${getBaseUrl()}/api/auth/microsoft/callback`
  );
}

function getTokenEndpoint() {
  const tenantId = process.env.MS_TENANT_ID?.trim() || 'common';
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

function normalizeEmailDomain(email: string) {
  return email.trim().toLowerCase();
}

function isAllowedEmail(email: string) {
  return isStaffEmailDomainAllowed(email);
}

function logOAuthDebug(step: string, details: Record<string, unknown>) {
  if (!OAUTH_DEBUG) return;
  // Keep logs concise and safe; do not log access tokens/secrets.
  console.info(`[MS_OAUTH] ${step}`, details);
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

  const clientId = process.env.MS_CLIENT_ID?.trim();
  const clientSecret = process.env.MS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    logOAuthDebug('missing_oauth_env', {
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
      redirectUri: getRedirectUri(),
      tokenEndpoint: getTokenEndpoint(),
    });
    loginUrl.searchParams.set('error', 'oauth');
    return NextResponse.redirect(loginUrl);
  }

  try {
    logOAuthDebug('token_exchange_start', {
      redirectUri: getRedirectUri(),
      tokenEndpoint: getTokenEndpoint(),
      codeLength: code.length,
    });

    const tokenRes = await fetch(getTokenEndpoint(), {
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
        console.warn('[MS_OAUTH] token exchange failed', { status: tokenRes.status });
      }
      await reportApiError({
        route: 'GET /api/auth/microsoft/callback',
        status: tokenRes.status,
        message: 'Microsoft token exchange failed.',
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

    logOAuthDebug('graph_me_start', {
      accessTokenLength: accessToken.length,
    });

    const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });

    if (!meRes.ok) {
      const meErrorText = await meRes.text().catch(() => '');
      logOAuthDebug('graph_me_failed', {
        status: meRes.status,
        body: meErrorText.slice(0, 500),
      });
      if (!OAUTH_DEBUG) {
        console.warn('[MS_OAUTH] graph profile lookup failed', { status: meRes.status });
      }
      await reportApiError({
        route: 'GET /api/auth/microsoft/callback',
        status: meRes.status,
        message: 'Microsoft profile lookup failed.',
      });
      loginUrl.searchParams.set('error', 'oauth');
      return NextResponse.redirect(loginUrl);
    }

    const me = (await meRes.json()) as { mail?: string | null; userPrincipalName?: string | null };
    const email = normalizeEmailDomain(me.mail || me.userPrincipalName || '');
    logOAuthDebug('graph_me_success', {
      hasMail: Boolean(me.mail),
      hasUpn: Boolean(me.userPrincipalName),
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
    response.cookies.set(STAFF_SESSION_COOKIE, `ms:${user.id}:${user.role}:${email}`, {
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
    console.error('[MS_OAUTH] callback exception', { message });
    await reportApiError({
      route: 'GET /api/auth/microsoft/callback',
      message,
    });
    loginUrl.searchParams.set('error', 'oauth');
    return NextResponse.redirect(loginUrl);
  }
}
