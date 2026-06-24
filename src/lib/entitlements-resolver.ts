import type { ModuleKey } from '@/lib/modules';
import type { DeploymentEntitlements } from '@/lib/entitlements-types';
import { horizontalQuotaForTier } from '@/lib/entitlement-buckets';
import type { DeploymentTier } from '@/lib/deployment-tier';
import { getDeploymentTier } from '@/lib/deployment-tier';

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

export function isControlPlaneSyncConfigured(): boolean {
  return Boolean(trimEnv('CONTROL_PLANE_URL') && trimEnv('CONTROL_PLANE_CUSTOMER_SLUG'));
}

type ControlPlanePayload = {
  slug: string;
  accountStatus: string;
  pastDueSince?: string | null;
  billingEmail?: string | null;
  planId: string;
  seatLimit: number | null;
  periodEnd: string | null;
  modules: Record<string, boolean>;
  features: Record<string, boolean | number | null>;
  horizontalQuota?: number;
  verticalEnginesAllowed?: boolean;
};

export async function fetchEntitlementsFromControlPlane(): Promise<DeploymentEntitlements | null> {
  const baseUrl = trimEnv('CONTROL_PLANE_URL');
  const slug = trimEnv('CONTROL_PLANE_CUSTOMER_SLUG');
  if (!baseUrl || !slug) return null;

  const apiKey = trimEnv('CONTROL_PLANE_INSTANCE_API_KEY');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/entitlements?slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) return null;

  const data = (await res.json()) as ControlPlanePayload;
  const planId = data.planId as DeploymentTier;

  return {
    slug: data.slug,
    accountStatus: data.accountStatus,
    pastDueSince: data.pastDueSince ?? null,
    billingEmail: data.billingEmail ?? null,
    planId: data.planId,
    seatLimit: data.seatLimit,
    periodEnd: data.periodEnd,
    modules: data.modules as Partial<Record<ModuleKey, boolean>>,
    features: data.features ?? {},
    horizontalQuota: data.horizontalQuota ?? horizontalQuotaForTier(planId),
    verticalEnginesAllowed: data.verticalEnginesAllowed ?? planId !== 'starter',
    syncedAt: new Date().toISOString(),
  };
}

export async function syncDeploymentEntitlements(): Promise<DeploymentEntitlements | null> {
  const fresh = await fetchEntitlementsFromControlPlane();
  if (!fresh) return null;
  const { saveDeploymentEntitlements } = await import('@/lib/entitlements-store');
  await saveDeploymentEntitlements(fresh);
  return fresh;
}

export function planIdToTier(planId: string | undefined): DeploymentTier {
  const n = planId?.trim().toLowerCase();
  if (n === 'starter' || n === 'growth' || n === 'enterprise') return n;
  return getDeploymentTier();
}
