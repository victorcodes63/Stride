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
import { usePathname } from 'next/navigation';
import {
  getDashboardModuleDomain,
  resolveDomainForPath,
  type DashboardModuleDomain,
  type DashboardModuleDomainId,
} from '@/lib/dashboard-module-domains';

type DashboardDomainContextValue = {
  activeDomainId: DashboardModuleDomainId;
  activeDomain: DashboardModuleDomain;
  /** Stable during SSR/hydration — falls back to the server pathname when the router is not ready. */
  pathname: string;
  /** Called when the user picks a domain in the topbar (pathname will sync on navigation). */
  setActiveDomainId: (id: DashboardModuleDomainId) => void;
};

const DashboardDomainContext = createContext<DashboardDomainContextValue | null>(null);

type DashboardDomainProviderProps = {
  children: ReactNode;
  initialPathname: string;
};

export function DashboardDomainProvider({ children, initialPathname }: DashboardDomainProviderProps) {
  const routerPathname = usePathname();
  const pathname = routerPathname || initialPathname;
  const pathDerivedId = useMemo(
    () => resolveDomainForPath(pathname),
    [pathname],
  );

  const [activeDomainId, setActiveDomainIdState] = useState<DashboardModuleDomainId>(pathDerivedId);

  useEffect(() => {
    setActiveDomainIdState(pathDerivedId);
  }, [pathDerivedId]);

  const setActiveDomainId = useCallback((id: DashboardModuleDomainId) => {
    setActiveDomainIdState(id);
  }, []);

  const activeDomain = useMemo(() => getDashboardModuleDomain(activeDomainId), [activeDomainId]);

  const value = useMemo(
    () => ({ activeDomainId, activeDomain, pathname, setActiveDomainId }),
    [activeDomain, activeDomainId, pathname, setActiveDomainId],
  );

  return <DashboardDomainContext.Provider value={value}>{children}</DashboardDomainContext.Provider>;
}

export function useDashboardDomain(): DashboardDomainContextValue {
  const ctx = useContext(DashboardDomainContext);
  if (!ctx) {
    throw new Error('useDashboardDomain must be used within DashboardDomainProvider');
  }
  return ctx;
}
