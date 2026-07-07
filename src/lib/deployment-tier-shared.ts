/**
 * Client-safe deployment tier helpers (no entitlements-store / server-only).
 */
import { isDemoMode } from '@/lib/deployment-flags';

export type DeploymentTier = 'starter' | 'growth' | 'enterprise';

/** @deprecated Company setup is available on all plans for now. */
export const COMPANY_SETUP_TIERS: readonly DeploymentTier[] = ['growth', 'enterprise'] as const;

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

export function parseDeploymentTier(raw: string | undefined): DeploymentTier | null {
  const n = raw?.trim().toLowerCase();
  if (n === 'starter' || n === 'growth' || n === 'enterprise') return n;
  return null;
}

/** Resolved tier from env (provision pushes planId from control plane). Demo → enterprise. */
export function getDeploymentTier(): DeploymentTier {
  if (isDemoMode()) return 'enterprise';
  return parseDeploymentTier(trimEnv('DEPLOYMENT_TIER')) ?? 'growth';
}

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
