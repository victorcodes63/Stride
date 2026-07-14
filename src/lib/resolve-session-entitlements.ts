import { isCustomerProductionCell, isDemoSandboxCell } from '@/lib/deployment-cell';
import { isDemoMode, isLocalDevAllModules, isPublicDemoMode } from '@/lib/deployment-flags';
import type { DeploymentEntitlements } from '@/lib/entitlements-types';
import { isEntitlementsStale } from '@/lib/entitlements-types';
import {
  fetchEntitlementsFromControlPlane,
  isControlPlaneSyncConfigured,
} from '@/lib/entitlements-resolver';
import { loadDeploymentEntitlements } from '@/lib/entitlements-store';
import { loadOrganizationEntitlements, saveOrganizationEntitlements } from '@/lib/org-entitlements-store';
import type { ModuleKey } from '@/lib/modules';
import { foundationalModulesOnly } from '@/lib/modules';

export { foundationalModulesOnly };

/**
 * Resolve entitlements for the signed-in org.
 * Customer cells never fall back to deployment-wide demo/default-org cache.
 */
export async function resolveSessionEntitlements(
  organizationId: string,
): Promise<DeploymentEntitlements | null> {
  let entitlements = await loadOrganizationEntitlements(organizationId);

  /**
   * Demo sandboxes license every module locally — never block bootstrap on a stale/misconfigured
   * control-plane URL (this hung demo.getstride.co.ke when CONTROL_PLANE_URL pointed at localhost).
   */
  const shouldSyncFromControlPlane =
    isControlPlaneSyncConfigured() &&
    !isDemoSandboxCell() &&
    (!entitlements || isEntitlementsStale(entitlements.syncedAt));

  if (shouldSyncFromControlPlane) {
    try {
      const fresh = await fetchEntitlementsFromControlPlane();
      if (fresh) {
        await saveOrganizationEntitlements(organizationId, fresh);
        entitlements = fresh;
      }
    } catch {
      // Keep cached org entitlements / demo defaults when the control plane is unreachable.
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
  /** Sales/demo cells license every module — control plane toggles are for operator testing only. */
  if (isDemoMode() || isPublicDemoMode() || isDemoSandboxCell() || isLocalDevAllModules()) {
    return entitlements
      ? {
          accountStatus: entitlements.accountStatus,
          verticalEnginesAllowed: true,
        }
      : undefined;
  }

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
