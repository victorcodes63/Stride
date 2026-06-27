import { isCustomerProductionCell, isDemoSandboxCell } from '@/lib/deployment-cell';
import type { DeploymentEntitlements } from '@/lib/entitlements-types';
import { isEntitlementsStale } from '@/lib/entitlements-types';
import {
  fetchEntitlementsFromControlPlane,
  isControlPlaneSyncConfigured,
} from '@/lib/entitlements-resolver';
import { loadDeploymentEntitlements } from '@/lib/entitlements-store';
import { loadOrganizationEntitlements, saveOrganizationEntitlements } from '@/lib/org-entitlements-store';
import type { ModuleKey } from '@/lib/modules';
import { MODULE_DEFINITIONS } from '@/lib/modules';

/** Fail-closed module map when control plane is configured but org cache is missing. */
export function foundationalModulesOnly(): Partial<Record<ModuleKey, boolean>> {
  return MODULE_DEFINITIONS.reduce(
    (acc, def) => {
      if (!def.canDisable || def.key === 'accounts') {
        acc[def.key] = true;
      } else if (def.key === 'ess') {
        acc[def.key] = true;
      } else {
        acc[def.key] = false;
      }
      return acc;
    },
    {} as Partial<Record<ModuleKey, boolean>>,
  );
}

/**
 * Resolve entitlements for the signed-in org.
 * Customer cells never fall back to deployment-wide demo/default-org cache.
 */
export async function resolveSessionEntitlements(
  organizationId: string,
): Promise<DeploymentEntitlements | null> {
  let entitlements = await loadOrganizationEntitlements(organizationId);

  if (
    isControlPlaneSyncConfigured() &&
    (!entitlements || isEntitlementsStale(entitlements.syncedAt))
  ) {
    const fresh = await fetchEntitlementsFromControlPlane();
    if (fresh) {
      await saveOrganizationEntitlements(organizationId, fresh);
      entitlements = fresh;
    }
  }

  if (entitlements) return entitlements;

  if (isDemoSandboxCell()) {
    return loadDeploymentEntitlements();
  }

  if (isCustomerProductionCell() || isControlPlaneSyncConfigured()) {
    return null;
  }

  return loadDeploymentEntitlements();
}

export function subscriptionFromEntitlements(
  entitlements: DeploymentEntitlements | null,
): {
  subscribedModules: Partial<Record<ModuleKey, boolean>>;
  accountStatus?: string;
  verticalEnginesAllowed?: boolean;
} | undefined {
  if (entitlements) {
    return {
      subscribedModules: entitlements.modules,
      accountStatus: entitlements.accountStatus,
      verticalEnginesAllowed: entitlements.verticalEnginesAllowed,
    };
  }

  if (isCustomerProductionCell() || isControlPlaneSyncConfigured()) {
    return {
      subscribedModules: foundationalModulesOnly(),
      accountStatus: 'active',
      verticalEnginesAllowed: false,
    };
  }

  return undefined;
}
