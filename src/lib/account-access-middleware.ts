import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  accountSuspendedPayload,
  accountSuspendedRedirectUrl,
  getAccountStatusFromRequest,
  isLoginBlockedAccountStatus,
  shouldBypassAccountGate,
} from '@/lib/account-access';

const ACCOUNT_EXEMPT_PREFIXES = [
  '/api/auth',
  '/api/config',
  '/api/webhooks',
  '/api/health',
  '/dashboard/login',
  '/dashboard/forgot-password',
  '/dashboard/account-suspended',
  '/ess/login',
  '/ess/account-suspended',
  '/ess/offline',
];

export function isAccountGateExempt(pathname: string): boolean {
  return ACCOUNT_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function enforceAccountAccess(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (isAccountGateExempt(pathname)) return null;

  const status = getAccountStatusFromRequest(request);
  if (!isLoginBlockedAccountStatus(status)) return null;

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(accountSuspendedPayload(), { status: 403 });
  }

  const portal = pathname.startsWith('/ess') ? 'ess' : 'staff';
  return NextResponse.redirect(accountSuspendedRedirectUrl(portal, request));
}
