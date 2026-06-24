import type { DeploymentEntitlements } from '@/lib/entitlements-types';
import { loadDeploymentEntitlements } from '@/lib/entitlements-store';
import type { ModuleKey } from '@/lib/modules';
import { getModuleLabel } from '@/lib/modules';

export type ModuleEntitlementViolation = {
  module: ModuleKey;
  moduleLabel: string;
};

/** When no control-plane cache exists, all modules are admin-configurable (legacy). */
export function isModuleEntitled(
  key: ModuleKey,
  entitlements: DeploymentEntitlements | null,
): boolean {
  if (!entitlements) return true;
  if (entitlements.modules[key] === false) return false;
  if (key === 'legal' && entitlements.modules.documents === true) return true;
  if (key === 'documents' && entitlements.modules.legal === true) return true;
  return entitlements.modules[key] !== false;
}

export function findModuleAdminViolations(
  moduleAdminFlags: Record<ModuleKey, boolean>,
  entitlements: DeploymentEntitlements | null,
): ModuleEntitlementViolation[] {
  if (!entitlements) return [];

  const violations: ModuleEntitlementViolation[] = [];

  for (const [key, enabled] of Object.entries(moduleAdminFlags) as [ModuleKey, boolean][]) {
    if (!enabled) continue;
    if (!isModuleEntitled(key, entitlements)) {
      violations.push({ module: key, moduleLabel: getModuleLabel(key) });
    }
  }

  return violations;
}

export function clampModuleAdminFlags(
  moduleAdminFlags: Record<ModuleKey, boolean>,
  entitlements: DeploymentEntitlements | null,
): Record<ModuleKey, boolean> {
  if (!entitlements) return moduleAdminFlags;

  const next = { ...moduleAdminFlags };
  for (const key of Object.keys(next) as ModuleKey[]) {
    if (!isModuleEntitled(key, entitlements)) {
      next[key] = false;
    }
  }
  return next;
}

export async function loadEntitlementsForAdminGuard(): Promise<DeploymentEntitlements | null> {
  return loadDeploymentEntitlements();
}

export function moduleNotEntitledResponse(violations: ModuleEntitlementViolation[]) {
  return {
    error: `Your subscription does not include: ${violations.map((v) => v.moduleLabel).join(', ')}. Contact Raven Tech Group to upgrade.`,
    code: 'MODULE_NOT_ENTITLED' as const,
    modules: violations.map((v) => v.module),
  };
}
