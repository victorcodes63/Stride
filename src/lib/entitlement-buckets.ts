import type { ModuleKey } from '@/lib/modules';
import type { DeploymentTier } from '@/lib/deployment-tier';
import { MODULE_BUCKET, type ModuleBucket as RegistryModuleBucket } from '@/lib/module-registry';

export type EntitlementBucket = RegistryModuleBucket;

export { MODULE_BUCKET };

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
