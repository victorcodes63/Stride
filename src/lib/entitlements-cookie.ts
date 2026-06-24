import type { DeploymentEntitlements } from '@/lib/entitlements-types';

export const ENTITLEMENTS_COOKIE = 'hris_entitlements';

const MAX_AGE_SECONDS = 60 * 60 * 8;

export function entitlementsSetCookieHeader(payload: DeploymentEntitlements): string {
  const value = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${ENTITLEMENTS_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

export function parseEntitlementsCookie(
  raw: string | undefined,
): DeploymentEntitlements | null {
  if (!raw?.trim()) return null;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    return JSON.parse(json) as DeploymentEntitlements;
  } catch {
    return null;
  }
}
