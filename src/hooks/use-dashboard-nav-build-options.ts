'use client';

import { useMemo } from 'react';
import type { DashboardNavBuildOptions } from '@/lib/dashboard-nav-catalog';
import { canAccessCompanySetup } from '@/lib/deployment-tier';
import { useDashboardSession } from '@/contexts/dashboard-session';

export function useDashboardNavBuildOptions(): DashboardNavBuildOptions {
  const { user, modules } = useDashboardSession();

  return useMemo(
    () => ({
      currentUserRole: user?.role ?? null,
      hasAccountsAccess: user?.hasAccountsAccess ?? false,
      canViewSystemAnalytics: user?.canViewSystemAnalytics ?? false,
      canAccessCompanySetup: canAccessCompanySetup(),
      enabledModules: modules,
    }),
    [user, modules],
  );
}
