import type { NextRequest } from 'next/server';

import { isDemoMode, isPublicDemoMode } from '@/lib/deployment-config';
import { parseEntitlementsCookie } from '@/lib/entitlements-cookie';

export type AccountStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'churned'
  | string;

export function getAccountStatusFromRequest(
  request: NextRequest,
): AccountStatus | null {
  const entitlements = parseEntitlementsCookie(
    request.cookies.get('hris_entitlements')?.value,
  );
  return entitlements?.accountStatus ?? null;
}

export function isLoginBlockedAccountStatus(status: AccountStatus | null): boolean {
  return status === 'suspended' || status === 'churned';
}

function parseBypassEmails(): string[] {
  const raw = process.env.RAVEN_ACCOUNT_BYPASS_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function shouldBypassAccountGate(email?: string | null): boolean {
  if (isDemoMode() || isPublicDemoMode()) return true;
  if (process.env.RAVEN_ACCOUNT_BYPASS === 'true') return true;
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return parseBypassEmails().includes(normalized);
}

export function accountSuspendedPayload() {
  return {
    error:
      'This Stride account is suspended. Contact Raven Tech Group to restore access.',
    code: 'ACCOUNT_SUSPENDED' as const,
  };
}

export function accountSuspendedRedirectUrl(
  portal: 'staff' | 'ess',
  request: NextRequest,
): URL {
  const path =
    portal === 'ess' ? '/ess/account-suspended' : '/dashboard/account-suspended';
  return new URL(path, request.url);
}
