import type { NextRequest } from 'next/server';

import { parseEntitlementsCookie } from '@/lib/entitlements-cookie';
import { shouldBypassAccountGate } from '@/lib/account-access';

export function getPastDueGraceDays(): number {
  const raw = Number(process.env.PAST_DUE_GRACE_DAYS ?? 14);
  return Number.isFinite(raw) && raw >= 0 ? raw : 14;
}

export function isPastDueReadOnly(
  accountStatus: string | null | undefined,
  pastDueSince: string | null | undefined,
): boolean {
  if (accountStatus !== 'past_due') return false;
  if (!pastDueSince) return false;

  const since = new Date(pastDueSince).getTime();
  if (Number.isNaN(since)) return false;

  const graceMs = getPastDueGraceDays() * 24 * 60 * 60 * 1000;
  return Date.now() - since > graceMs;
}

export function isPastDueBannerVisible(accountStatus: string | null | undefined): boolean {
  return accountStatus === 'past_due';
}

export function getPastDueContextFromRequest(request: NextRequest) {
  const ent = parseEntitlementsCookie(request.cookies.get('hris_entitlements')?.value);
  return {
    accountStatus: ent?.accountStatus ?? null,
    pastDueSince: ent?.pastDueSince ?? null,
    billingEmail: ent?.billingEmail ?? null,
  };
}

export function shouldBlockMutationForAccount(
  request: NextRequest,
  method: string,
): boolean {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    return false;
  }

  const { accountStatus, pastDueSince } = getPastDueContextFromRequest(request);
  if (!isPastDueReadOnly(accountStatus, pastDueSince)) return false;

  return !shouldBypassAccountGate(null);
}

export function pastDueReadOnlyPayload() {
  return {
    error:
      'This account is past due. Write access is disabled until payment is received. Contact Raven Tech Group.',
    code: 'ACCOUNT_READ_ONLY' as const,
  };
}
