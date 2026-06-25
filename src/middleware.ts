import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getBlockedModuleForPath,
  getEffectiveModulesFromRequest,
  moduleAccessDeniedPayload,
  moduleUnavailableRedirectUrl,
} from '@/lib/module-access';
import { enforceAccountAccess } from '@/lib/account-access-middleware';
import { enforcePastDueReadOnly } from '@/lib/account-readonly-middleware';
import { applySecurityHeaders } from '@/lib/security-headers';
import { enforceAuthRateLimit } from '@/lib/auth-rate-limit-response';
import {
  buildCrossOriginUrl,
  getAppOrigin,
  getMarketingOrigin,
  getSiteMode,
  isAppPath,
  isMarketingPath,
} from '@/lib/site-mode';

const STAFF_SESSION_COOKIE = 'staff_session';
const ESS_SESSION_COOKIE = 'ess_session';
const LOGIN_PATH = '/dashboard/login';
const FORGOT_PASSWORD_PATH = '/dashboard/forgot-password';
const ESS_LOGIN_PATH = '/ess/login';

function redirectPermanent(pathname: string, request: NextRequest) {
  const u = new URL(request.url);
  u.pathname = pathname;
  return NextResponse.redirect(u, 308);
}

function redirectCrossOrigin(
  origin: string,
  pathname: string,
  request: NextRequest,
  status: 301 | 302 | 307 | 308 = 301,
) {
  const target = buildCrossOriginUrl(origin, pathname, request.nextUrl.search);
  return NextResponse.redirect(target, status);
}

/** RAV-170 — marketing ↔ app domain split. */
function enforceSiteMode(request: NextRequest): NextResponse | null {
  const mode = getSiteMode();
  if (mode === 'unified') return null;

  const { pathname } = request.nextUrl;

  if (mode === 'app') {
    if (pathname === '/') {
      return NextResponse.rewrite(new URL(LOGIN_PATH, request.url));
    }
    if (isMarketingPath(pathname)) {
      return redirectCrossOrigin(getMarketingOrigin(), pathname, request);
    }
    return null;
  }

  // marketing deploy
  if (isAppPath(pathname)) {
    return redirectCrossOrigin(getAppOrigin(), pathname, request);
  }

  return null;
}

function enforceModuleLicense(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const effectiveModules = getEffectiveModulesFromRequest(request);
  const blocked = getBlockedModuleForPath(pathname, effectiveModules);
  if (!blocked) return null;

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(moduleAccessDeniedPayload(blocked), { status: 403 });
  }

  if (pathname.startsWith('/ess')) {
    const loginUrl = new URL(ESS_LOGIN_PATH, request.url);
    loginUrl.searchParams.set('error', 'module-disabled');
    loginUrl.searchParams.set('module', blocked);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/careers') || pathname.startsWith('/interview')) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  const redirectUrl = new URL(
    moduleUnavailableRedirectUrl(blocked, pathname),
    request.url,
  );
  return NextResponse.redirect(redirectUrl);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const siteModeBlock = enforceSiteMode(request);
  if (siteModeBlock) return applySecurityHeaders(siteModeBlock);

  if (pathname === '/api/auth/login' || pathname === '/api/ess/auth/login') {
    const rateLimited = enforceAuthRateLimit(pathname, request);
    if (rateLimited) return applySecurityHeaders(rateLimited);
  }

  if (pathname === '/dashboard/outsourcing/payroll') {
    return redirectPermanent('/dashboard/accounts/payroll', request);
  }
  if (pathname === '/dashboard/outsourcing/payroll/payslips') {
    return redirectPermanent('/dashboard/accounts/payroll/payslips', request);
  }

  const moduleBlock = enforceModuleLicense(request);
  if (moduleBlock) return moduleBlock;

  const accountBlock = enforceAccountAccess(request);
  if (accountBlock) return accountBlock;

  const readOnlyBlock = enforcePastDueReadOnly(request);
  if (readOnlyBlock) return readOnlyBlock;

  const isAuthPage = pathname.startsWith(LOGIN_PATH) || pathname.startsWith(FORGOT_PASSWORD_PATH);
  if (pathname.startsWith('/dashboard') && !isAuthPage) {
    const session = request.cookies.get(STAFF_SESSION_COOKIE);
    if (!session?.value) {
      const loginUrl = new URL(LOGIN_PATH, request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const isEssPublicPage =
    pathname.startsWith(ESS_LOGIN_PATH) || pathname === '/ess/offline';
  if (pathname.startsWith('/ess') && !isEssPublicPage) {
    const session = request.cookies.get(ESS_SESSION_COOKIE);
    if (!session?.value) {
      const loginUrl = new URL(ESS_LOGIN_PATH, request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    '/',
    '/platform/:path*',
    '/industries/:path*',
    '/pricing/:path*',
    '/about/:path*',
    '/contact/:path*',
    '/demo-access/:path*',
    '/v3/:path*',
    '/privacy/:path*',
    '/terms/:path*',
    '/dashboard/:path*',
    '/ess/:path*',
    '/careers/:path*',
    '/interview/:path*',
    '/api/:path*',
  ],
};
