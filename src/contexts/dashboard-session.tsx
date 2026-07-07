'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { BOOTSTRAP_PENDING_MODULES } from '@/lib/bootstrap-pending-modules';
import type { ModuleKey } from '@/lib/modules';
import type { OverviewCoreMetrics } from '@/lib/dashboard-overview-metrics';
import type { DashboardOverviewLayout } from '@/lib/dashboard-overview-layout';
import type { UserSummary } from '@/types/dashboard';

type DashboardSessionValue = {
  user: UserSummary | null;
  modules: Record<ModuleKey, boolean>;
  overviewCore: OverviewCoreMetrics | null;
  overviewLayout: DashboardOverviewLayout | null;
  overviewLayoutIsCustom: boolean;
};

const DashboardSessionContext = createContext<DashboardSessionValue>({
  user: null,
  modules: BOOTSTRAP_PENDING_MODULES,
  overviewCore: null,
  overviewLayout: null,
  overviewLayoutIsCustom: false,
});

export function DashboardSessionProvider({
  user,
  modules,
  overviewCore = null,
  overviewLayout = null,
  overviewLayoutIsCustom = false,
  children,
}: {
  user: UserSummary | null;
  modules: Record<ModuleKey, boolean>;
  overviewCore?: OverviewCoreMetrics | null;
  overviewLayout?: DashboardOverviewLayout | null;
  overviewLayoutIsCustom?: boolean;
  children: ReactNode;
}) {
  return (
    <DashboardSessionContext.Provider
      value={{ user, modules, overviewCore, overviewLayout, overviewLayoutIsCustom }}
    >
      {children}
    </DashboardSessionContext.Provider>
  );
}

export function useDashboardSession() {
  return useContext(DashboardSessionContext);
}
