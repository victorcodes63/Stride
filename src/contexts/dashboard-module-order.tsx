'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DASHBOARD_MODULE_DOMAINS,
  filterActiveDomains,
  filterDomainsForSwitcher,
  resolvePlatformAdminAccess,
  type DashboardModuleDomain,
  type DashboardModuleDomainId,
  type DomainWithAccess,
  type SwitcherAccessContext,
} from '@/lib/dashboard-module-domains';
import { CANONICAL_MODULE_ORDER, orderModuleDomains } from '@/lib/dashboard-module-preferences';
import type { ModuleKey } from '@/lib/modules';
import type { DeploymentTier } from '@/lib/deployment-tier';
import { getDeploymentTier } from '@/lib/deployment-tier';
import type { UserRole } from '@/types/dashboard';

type DashboardModuleOrderContextValue = {
  orderedDomains: DomainWithAccess[];
  /** Licensed and role-assigned modules only — use in switcher and overview nav. */
  visibleDomains: DomainWithAccess[];
  moduleOrder: DashboardModuleDomainId[];
  isCustom: boolean;
  loading: boolean;
  saveModuleOrder: (order: DashboardModuleDomainId[]) => Promise<void>;
  resetModuleOrder: () => Promise<void>;
  moveModule: (id: DashboardModuleDomainId, direction: 'up' | 'down') => Promise<void>;
};

const DashboardModuleOrderContext = createContext<DashboardModuleOrderContextValue | null>(null);

export function DashboardModuleOrderProvider({
  children,
  enabledModules,
  deploymentTier = getDeploymentTier(),
  currentUserRole = null,
  hasAccountsAccess = false,
  canViewSystemAnalytics = false,
  canAccessCompanySetup = false,
}: {
  children: ReactNode;
  enabledModules?: Record<ModuleKey, boolean>;
  deploymentTier?: DeploymentTier;
  currentUserRole?: UserRole | null;
  hasAccountsAccess?: boolean;
  canViewSystemAnalytics?: boolean;
  canAccessCompanySetup?: boolean;
}) {
  const [moduleOrder, setModuleOrder] = useState<DashboardModuleDomainId[]>([...CANONICAL_MODULE_ORDER]);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard/module-preferences', { credentials: 'include' })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data: { moduleOrder?: DashboardModuleDomainId[]; isCustom?: boolean } | null) => {
        if (cancelled || !data?.moduleOrder?.length) return;
        setModuleOrder(data.moduleOrder);
        setIsCustom(data.isCustom === true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const accessContext = useMemo<SwitcherAccessContext>(
    () => ({
      canAccessPlatformAdmin: resolvePlatformAdminAccess({
        currentUserRole,
        hasAccountsAccess,
        canViewSystemAnalytics,
        canAccessCompanySetup,
      }),
    }),
    [currentUserRole, hasAccountsAccess, canViewSystemAnalytics, canAccessCompanySetup],
  );

  const orderedDomains = useMemo(() => {
    const ordered = orderModuleDomains(DASHBOARD_MODULE_DOMAINS, moduleOrder);
    if (!enabledModules) {
      return ordered.map((domain) => ({ ...domain, access: 'active' as const }));
    }
    return filterDomainsForSwitcher(ordered, enabledModules, deploymentTier, accessContext);
  }, [moduleOrder, enabledModules, deploymentTier, accessContext]);

  const visibleDomains = useMemo(
    () => filterActiveDomains(orderedDomains),
    [orderedDomains],
  );

  const persist = useCallback(async (order: DashboardModuleDomainId[], custom: boolean) => {
    const response = await fetch('/api/dashboard/module-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(custom ? { moduleOrder: order } : { reset: true }),
    });
    const data = (await response.json()) as {
      moduleOrder?: DashboardModuleDomainId[];
      isCustom?: boolean;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error || 'Failed to save module order');
    }
    if (Array.isArray(data.moduleOrder)) {
      setModuleOrder(data.moduleOrder);
      setIsCustom(data.isCustom === true);
    }
  }, []);

  const saveModuleOrder = useCallback(
    async (order: DashboardModuleDomainId[]) => {
      await persist(order, true);
    },
    [persist],
  );

  const resetModuleOrder = useCallback(async () => {
    await persist([], false);
  }, [persist]);

  const moveModule = useCallback(
    async (id: DashboardModuleDomainId, direction: 'up' | 'down') => {
      const index = moduleOrder.indexOf(id);
      if (index < 0) return;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= moduleOrder.length) return;
      const next = [...moduleOrder];
      const current = next[index]!;
      next[index] = next[target]!;
      next[target] = current;
      await saveModuleOrder(next);
    },
    [moduleOrder, saveModuleOrder],
  );

  const value = useMemo(
    () => ({
      orderedDomains,
      visibleDomains,
      moduleOrder,
      isCustom,
      loading,
      saveModuleOrder,
      resetModuleOrder,
      moveModule,
    }),
    [
      orderedDomains,
      visibleDomains,
      moduleOrder,
      isCustom,
      loading,
      saveModuleOrder,
      resetModuleOrder,
      moveModule,
    ],
  );

  return (
    <DashboardModuleOrderContext.Provider value={value}>
      {children}
    </DashboardModuleOrderContext.Provider>
  );
}

export function useDashboardModuleOrder(): DashboardModuleOrderContextValue {
  const context = useContext(DashboardModuleOrderContext);
  if (!context) {
    throw new Error('useDashboardModuleOrder must be used within DashboardModuleOrderProvider');
  }
  return context;
}
