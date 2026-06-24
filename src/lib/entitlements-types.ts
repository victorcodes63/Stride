import type { ModuleKey } from '@/lib/modules';

/** Cached control-plane entitlement payload stored in SystemSetting + cookie. */
export type DeploymentEntitlements = {
  slug: string;
  accountStatus: string;
  pastDueSince?: string | null;
  billingEmail?: string | null;
  planId: string;
  seatLimit: number | null;
  periodEnd: string | null;
  modules: Partial<Record<ModuleKey, boolean>>;
  features: Record<string, boolean | number | null>;
  horizontalQuota: number;
  verticalEnginesAllowed: boolean;
  syncedAt: string;
};

export const DEPLOYMENT_ENTITLEMENTS_KEY = 'deployment_entitlements';

export const ENTITLEMENTS_STALE_MS = 15 * 60 * 1000;

export function isEntitlementsStale(syncedAt: string | undefined): boolean {
  if (!syncedAt) return true;
  const age = Date.now() - new Date(syncedAt).getTime();
  return age > ENTITLEMENTS_STALE_MS;
}
