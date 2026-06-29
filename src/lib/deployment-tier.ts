/**
 * Commercial deployment tier — module quotas and (future) white-label fork gating.
 * Plan is synced from the control plane (subscription.planId → DEPLOYMENT_TIER on provision).
 * Company setup access is not tier-gated; enterprise-only forks will be a separate control-plane flag later.
 */

import { isDemoMode } from '@/lib/deployment-config';

export type DeploymentTier = 'starter' | 'growth' | 'enterprise';

/** @deprecated Company setup is available on all plans for now. */
export const COMPANY_SETUP_TIERS: readonly DeploymentTier[] = ['growth', 'enterprise'] as const;

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function parseTier(raw: string | undefined): DeploymentTier | null {
  const n = raw?.trim().toLowerCase();
  if (n === 'starter' || n === 'growth' || n === 'enterprise') return n;
  return null;
}

/** Resolved tier from env (provision pushes planId from control plane). Demo → enterprise. */
export function getDeploymentTier(): DeploymentTier {
  if (isDemoMode()) return 'enterprise';
  return parseTier(trimEnv('DEPLOYMENT_TIER')) ?? 'growth';
}

/** Prefer cached control-plane entitlements, then env. */
export async function resolveDeploymentTier(): Promise<DeploymentTier> {
  if (isDemoMode()) return 'enterprise';
  try {
    const { loadDeploymentEntitlements } = await import('@/lib/entitlements-store');
    const entitlements = await loadDeploymentEntitlements();
    const fromPlan = parseTier(entitlements?.planId);
    if (fromPlan) return fromPlan;
  } catch {
    // fall through to env
  }
  return getDeploymentTier();
}

/** Company setup is available to all tenants; tier forks come later via control plane. */
export function canAccessCompanySetup(_tier?: DeploymentTier): boolean {
  return true;
}

export function companySetupTierLabel(tier: DeploymentTier = getDeploymentTier()): string {
  switch (tier) {
    case 'starter':
      return 'Starter';
    case 'growth':
      return 'Growth';
    case 'enterprise':
      return 'Enterprise';
  }
}
