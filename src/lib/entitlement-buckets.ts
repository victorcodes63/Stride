import type { ModuleKey } from '@/lib/modules';
import type { DeploymentTier } from '@/lib/deployment-tier';

export type EntitlementBucket = 'foundational' | 'horizontal' | 'vertical';

export const MODULE_BUCKET: Record<ModuleKey, EntitlementBucket> = {
  core: 'foundational',
  leave: 'foundational',
  time: 'foundational',
  payroll: 'foundational',
  ess: 'foundational',
  disciplinary: 'foundational',
  accounts: 'foundational',
  procurement: 'horizontal',
  legal: 'horizontal',
  ats: 'horizontal',
  performance: 'horizontal',
  training: 'horizontal',
  documents: 'horizontal',
  communications: 'horizontal',
  reports: 'horizontal',
  hse: 'vertical',
  assets: 'vertical',
  fleet: 'vertical',
};

export function horizontalQuotaForTier(tier: DeploymentTier): number {
  switch (tier) {
    case 'starter':
      return 2;
    case 'growth':
      return 4;
    case 'enterprise':
      return Infinity;
    default:
      return 2;
  }
}

export function verticalAllowedOnTier(tier: DeploymentTier): boolean {
  return tier !== 'starter';
}

export function countActiveHorizontalModules(
  modules: Record<ModuleKey, boolean>,
): number {
  return Object.entries(MODULE_BUCKET).filter(
    ([key, bucket]) => bucket === 'horizontal' && modules[key as ModuleKey],
  ).length;
}

export function bucketPayload(modules: Record<ModuleKey, boolean>) {
  const byBucket = (bucket: EntitlementBucket) =>
    Object.entries(MODULE_BUCKET)
      .filter(([, b]) => b === bucket)
      .map(([k]) => k as ModuleKey)
      .filter((key) => modules[key]);

  return {
    foundational: byBucket('foundational'),
    horizontal: byBucket('horizontal'),
    vertical: byBucket('vertical'),
  };
}
