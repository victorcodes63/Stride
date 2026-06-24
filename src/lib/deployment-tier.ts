/**
 * Commercial deployment tier — controls which admin capabilities are available
 * on a dedicated client instance (separate from per-user roles).
 */

import { isDemoMode } from '@/lib/deployment-config';

export type DeploymentTier = 'starter' | 'growth' | 'enterprise';

/** Tiers that include self-service company / branding setup. */
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

/** Resolved tier for this deployment. Demo instances always run as enterprise. */
export function getDeploymentTier(): DeploymentTier {
  if (isDemoMode()) return 'enterprise';
  return parseTier(trimEnv('DEPLOYMENT_TIER')) ?? 'growth';
}

export function canAccessCompanySetup(): boolean {
  return COMPANY_SETUP_TIERS.includes(getDeploymentTier());
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

export function companySetupUpgradeCopy(): string {
  const tier = getDeploymentTier();
  return `Company setup and branding controls are included on Growth and Enterprise plans. This instance is on ${companySetupTierLabel(tier)} — contact Raven Tech Group to upgrade.`;
}
