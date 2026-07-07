import 'server-only';

import { getDeploymentTier, parseDeploymentTier, type DeploymentTier } from '@/lib/deployment-tier-shared';

/** Prefer cached control-plane entitlements, then env. */
export async function resolveDeploymentTier(): Promise<DeploymentTier> {
  if (parseBoolean(process.env.DEMO_MODE, false)) return 'enterprise';
  try {
    const { loadDeploymentEntitlements } = await import('@/lib/entitlements-store');
    const entitlements = await loadDeploymentEntitlements();
    const fromPlan = parseDeploymentTier(entitlements?.planId);
    if (fromPlan) return fromPlan;
  } catch {
    // fall through to env
  }
  return getDeploymentTier();
}

function parseBoolean(v: string | undefined, defaultValue: boolean): boolean {
  if (v === undefined || v === '') return defaultValue;
  const n = v.trim().toLowerCase();
  if (n === '1' || n === 'true' || n === 'yes' || n === 'on') return true;
  if (n === '0' || n === 'false' || n === 'no' || n === 'off') return false;
  return defaultValue;
}
