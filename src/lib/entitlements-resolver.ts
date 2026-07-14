import type { ModuleKey } from '@/lib/modules';
import type { DeploymentEntitlements } from '@/lib/entitlements-types';
import { horizontalQuotaForTier } from '@/lib/entitlement-buckets';
import type { DeploymentTier } from '@/lib/deployment-tier';
import { getDeploymentTier } from '@/lib/deployment-tier';
import {
  getControlPlaneCustomerSlug,
  getControlPlaneUrl,
  isControlPlaneSyncConfigured,
} from '@/lib/entitlements-env';

export { isControlPlaneSyncConfigured } from '@/lib/entitlements-env';

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
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

/** Bound CP round-trips so a dead/misconfigured URL cannot stall dashboard bootstrap. */
const CONTROL_PLANE_FETCH_TIMEOUT_MS = 2_500;

function isLocalControlPlaneUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

export async function fetchEntitlementsFromControlPlane(): Promise<DeploymentEntitlements | null> {
  const baseUrl = getControlPlaneUrl();
  const slug = getControlPlaneCustomerSlug();
  if (!baseUrl || !slug) return null;

  // Deployed cells must never call a developer's local control plane.
  if (process.env.VERCEL && isLocalControlPlaneUrl(baseUrl)) {
    console.warn(
      '[entitlements] Skipping CONTROL_PLANE_URL pointing at localhost on a Vercel deployment.',
    );
    return null;
  }

  const apiKey = trimEnv('CONTROL_PLANE_INSTANCE_API_KEY');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/entitlements?slug=${encodeURIComponent(slug)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONTROL_PLANE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, cache: 'no-store', signal: controller.signal });
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
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    console.warn(
      `[entitlements] Control-plane fetch ${aborted ? 'timed out' : 'failed'}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
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
