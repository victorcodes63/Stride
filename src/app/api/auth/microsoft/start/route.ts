import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { assertOAuthProviderEnabled } from '@/lib/oauth/assert-oauth-enabled';

const OAUTH_STATE_COOKIE = 'staff_oauth_state';
const OAUTH_STATE_MAX_AGE = 60 * 10; // 10 minutes

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

export async function GET(request: NextRequest) {
  const disabled = await assertOAuthProviderEnabled(request, 'staff', 'microsoft');
  if (disabled) return disabled;

  const clientId = process.env.MS_CLIENT_ID?.trim();
  const tenantId = process.env.MS_TENANT_ID?.trim() || 'common';
  if (!clientId) {
    return NextResponse.redirect(new URL('/dashboard/login?error=oauth', request.url));
  }

  const redirectUri = getRedirectUri();
  const state = crypto.randomBytes(24).toString('hex');
  const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', 'openid profile email User.Read');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');

  const response = NextResponse.redirect(authUrl);
  const cookieDomain = getCookieDomain(request.url);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: OAUTH_STATE_MAX_AGE,
    path: '/',
    ...(cookieDomain && { domain: cookieDomain }),
  });
  return response;
}
