import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { isEssAllowedEmail } from '@/lib/ess-allowed-domains';
import { getEssSessionMaxAgeSeconds, type ParsedEssSession } from '@/lib/ess-session';
import { buildGoogleAuthorizeUrl, buildMicrosoftAuthorizeUrl } from '@/lib/auth/platform-oauth';
import { exchangeGoogleCodeForEmail } from '@/lib/oauth/google-email';
import { exchangeMicrosoftCodeForEmail } from '@/lib/oauth/microsoft-email';
import {
  getOAuthCookieDomain,
  getOAuthLoginPath,
  getOAuthSuccessPath,
  type OAuthAudience,
} from '@/lib/oauth-utils';

const ESS_SESSION_COOKIE = 'ess_session';
const ESS_SESSION_MAX_AGE = getEssSessionMaxAgeSeconds();

export const ESS_OAUTH_STATE_COOKIES = {
  microsoft: 'ess_oauth_state_ms',
  google: 'ess_oauth_state_google',
} as const;

export function createEssOAuthStartResponse(
  request: NextRequest,
  provider: 'microsoft' | 'google',
): NextResponse {
  const loginHint = request.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  const hostedDomain = request.nextUrl.searchParams.get('hd')?.trim().toLowerCase();
  const state = crypto.randomBytes(24).toString('hex');

  const authUrl =
    provider === 'microsoft'
      ? buildMicrosoftAuthorizeUrl({ audience: 'ess', state, loginHint: loginHint || undefined })
      : buildGoogleAuthorizeUrl({
          audience: 'ess',
          state,
          loginHint: loginHint || undefined,
          hostedDomain: hostedDomain || undefined,
        });

  if (!authUrl) {
    return NextResponse.redirect(new URL(`${getOAuthLoginPath('ess')}?error=oauth`, request.url));
  }

  const response = NextResponse.redirect(authUrl);
  const cookieDomain = getOAuthCookieDomain(request.url);
  response.cookies.set(ESS_OAUTH_STATE_COOKIES[provider], state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
    ...(cookieDomain && { domain: cookieDomain }),
  });
  return response;
}

function denyEssLogin(request: NextRequest, reason: string) {
  const denied = NextResponse.redirect(new URL(`${getOAuthLoginPath('ess')}?error=${reason}`, request.url));
  const cookieDomain = getOAuthCookieDomain(request.url);
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
    ...(cookieDomain && { domain: cookieDomain }),
  };
  denied.cookies.set(ESS_OAUTH_STATE_COOKIES.microsoft, '', opts);
  denied.cookies.set(ESS_OAUTH_STATE_COOKIES.google, '', opts);
  denied.cookies.set(ESS_SESSION_COOKIE, '', opts);
  return denied;
}

function buildEssSessionValue(
  provider: ParsedEssSession['provider'],
  userId: string,
  role: string,
  email: string,
): string {
  return `${provider}:${userId}:${role}:${email}`;
}

export async function completeEssOAuthCallback(
  request: NextRequest,
  provider: 'microsoft' | 'google',
): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const oauthError = request.nextUrl.searchParams.get('error');
  const stateCookie = request.cookies.get(ESS_OAUTH_STATE_COOKIES[provider])?.value;
  const loginUrl = new URL(getOAuthLoginPath('ess'), request.url);
  const successUrl = new URL(getOAuthSuccessPath('ess'), request.url);

  if (oauthError) {
    loginUrl.searchParams.set('error', 'oauth');
    return NextResponse.redirect(loginUrl);
  }

  if (!code || !state || !stateCookie || state !== stateCookie) {
    loginUrl.searchParams.set('error', 'oauth');
    return NextResponse.redirect(loginUrl);
  }

  const audience: OAuthAudience = 'ess';
  const emailResult =
    provider === 'microsoft'
      ? await exchangeMicrosoftCodeForEmail(code, audience)
      : await exchangeGoogleCodeForEmail(code, audience);

  if ('error' in emailResult) {
    loginUrl.searchParams.set('error', 'oauth');
    return NextResponse.redirect(loginUrl);
  }

  const email = emailResult.email;
  if (!isEssAllowedEmail(email)) {
    return denyEssLogin(request, 'domain');
  }

  if (!process.env.DATABASE_URL) {
    return denyEssLogin(request, 'oauth');
  }

  const user = await prisma.essPortalUser.findUnique({
    where: { email },
    select: { id: true, role: true, isActive: true, email: true },
  });

  if (!user) return denyEssLogin(request, 'no_account');
  if (!user.isActive) return denyEssLogin(request, 'inactive');

  await prisma.essPortalUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const sessionProvider = provider === 'microsoft' ? 'ms' : 'google';
  const response = NextResponse.redirect(successUrl);
  const cookieDomain = getOAuthCookieDomain(request.url);
  response.cookies.set(
    ESS_SESSION_COOKIE,
    buildEssSessionValue(sessionProvider, user.id, user.role, email),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ESS_SESSION_MAX_AGE,
      path: '/',
      ...(cookieDomain && { domain: cookieDomain }),
    },
  );
  response.cookies.set(ESS_OAUTH_STATE_COOKIES[provider], '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
    ...(cookieDomain && { domain: cookieDomain }),
  });
  return response;
}
