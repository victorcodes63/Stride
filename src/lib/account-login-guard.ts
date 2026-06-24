import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  accountSuspendedPayload,
  isLoginBlockedAccountStatus,
  shouldBypassAccountGate,
} from '@/lib/account-access';
import { loadDeploymentEntitlements } from '@/lib/entitlements-store';

/** Block credential login when subscription account is suspended/churned. */
export async function assertAccountLoginAllowed(
  email: string | null | undefined,
): Promise<NextResponse | null> {
  if (shouldBypassAccountGate(email)) return null;

  const entitlements = await loadDeploymentEntitlements();
  const status = entitlements?.accountStatus ?? null;
  if (!isLoginBlockedAccountStatus(status)) return null;

  return NextResponse.json(accountSuspendedPayload(), { status: 403 });
}

export async function getAccountStatusForRequest(
  request: NextRequest,
): Promise<string | null> {
  const fromCookie = request.cookies.get('hris_entitlements')?.value;
  if (fromCookie) {
    try {
      const json = Buffer.from(fromCookie, 'base64url').toString('utf8');
      const data = JSON.parse(json) as { accountStatus?: string };
      if (data.accountStatus) return data.accountStatus;
    } catch {
      /* fall through */
    }
  }
  const entitlements = await loadDeploymentEntitlements();
  return entitlements?.accountStatus ?? null;
}
