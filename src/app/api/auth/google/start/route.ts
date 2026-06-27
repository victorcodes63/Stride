import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildGoogleAuthorizeUrl } from '@/lib/auth/platform-oauth';
import { getOAuthCookieDomain } from '@/lib/oauth-utils';
import { assertOAuthProviderEnabled } from '@/lib/oauth/assert-oauth-enabled';

const OAUTH_STATE_COOKIE = 'staff_oauth_state_google';
const OAUTH_STATE_MAX_AGE = 60 * 10;

export async function GET(request: NextRequest) {
  const disabled = await assertOAuthProviderEnabled(request, 'staff', 'google');
  if (disabled) return disabled;

  const loginHint = request.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  const hostedDomain = request.nextUrl.searchParams.get('hd')?.trim().toLowerCase();

  const state = crypto.randomBytes(24).toString('hex');
  const authUrl = buildGoogleAuthorizeUrl({
    audience: 'staff',
    state,
    loginHint: loginHint || undefined,
    hostedDomain: hostedDomain || undefined,
  });

  if (!authUrl) {
    return NextResponse.redirect(new URL('/dashboard/login?error=oauth', request.url));
  }

  const response = NextResponse.redirect(authUrl);
  const cookieDomain = getOAuthCookieDomain(request.url);
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
