'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ModuleKey } from '@/lib/modules';
import type { UserSummary } from '@/types/dashboard';

const ALL_MODULES_ON: Record<ModuleKey, boolean> = {
  core: true,
  leave: true,
  time: true,
  payroll: true,
  ats: true,
  performance: true,
  hse: true,
  accounts: true,
  disciplinary: true,
  reports: true,
  assets: true,
  ess: true,
  communications: true,
  training: true,
  documents: true,
};

type DashboardSessionValue = {
  user: UserSummary | null;
  modules: Record<ModuleKey, boolean>;
};

const DashboardSessionContext = createContext<DashboardSessionValue>({
  user: null,
  modules: ALL_MODULES_ON,
});

export function DashboardSessionProvider({
  user,
  modules,
  children,
}: {
  user: UserSummary | null;
  modules: Record<ModuleKey, boolean>;
  children: ReactNode;
}) {
  return (
    <DashboardSessionContext.Provider value={{ user, modules }}>
      {children}
    </DashboardSessionContext.Provider>
  );
}

export function useDashboardSession() {
  return useContext(DashboardSessionContext);
}
