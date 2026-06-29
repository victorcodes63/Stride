import type { NextRequest, NextResponse } from 'next/server';
import type { CompanySetupSettings } from '@/lib/company-setup';
import { loadCompanySetupSettingsForOrg } from '@/lib/company-setup';
import { requireRecentSensitiveAuth } from '@/lib/admin-security';

export type SensitiveReauthPolicy = Pick<
  CompanySetupSettings,
  'sensitiveActionReauthEnabled' | 'sensitiveActionReauthUserIds'
>;

export function sanitizeSensitiveReauthUserIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

/** Admins never require re-auth; others only when org policy applies to them. */
export function userRequiresSensitiveReauth(
  policy: SensitiveReauthPolicy,
  userId: string,
  userRole: string,
): boolean {
  if (userRole === 'admin') return false;
  if (!policy.sensitiveActionReauthEnabled) return false;
  const selected = policy.sensitiveActionReauthUserIds;
  if (selected.length === 0) return true;
  return selected.includes(userId);
}

export async function guardSensitiveAction(
  request: NextRequest,
  input: { userId: string; userRole: string; organizationId: string },
): Promise<NextResponse | null> {
  const setup = await loadCompanySetupSettingsForOrg(input.organizationId);
  if (!userRequiresSensitiveReauth(setup, input.userId, input.userRole)) {
    return null;
  }
  return requireRecentSensitiveAuth(request, input.userId);
}
