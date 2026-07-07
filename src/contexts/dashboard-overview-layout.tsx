'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_OVERVIEW_LAYOUT,
  type DashboardOverviewLayout,
  type OverviewWidgetId,
  toggleKpiPin,
  toggleWidgetPin,
  toggleWidgetHidden,
  sanitizeDashboardOverviewLayout,
} from '@/lib/dashboard-overview-layout';
import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';

type DashboardOverviewLayoutContextValue = {
  layout: DashboardOverviewLayout;
  isCustom: boolean;
  loading: boolean;
  toggleWidgetPin: (widgetId: OverviewWidgetId) => Promise<void>;
  toggleWidgetHidden: (widgetId: OverviewWidgetId) => Promise<void>;
  toggleKpiPin: (domainId: DashboardModuleDomainId) => Promise<void>;
  isWidgetPinned: (widgetId: OverviewWidgetId) => boolean;
  isKpiPinned: (domainId: DashboardModuleDomainId) => boolean;
  resetLayout: () => Promise<void>;
};

const DashboardOverviewLayoutContext = createContext<DashboardOverviewLayoutContextValue | null>(null);

export function DashboardOverviewLayoutProvider({
  children,
  initialLayout = null,
  initialIsCustom = false,
  layoutReady = false,
}: {
  children: ReactNode;
  initialLayout?: DashboardOverviewLayout | null;
  initialIsCustom?: boolean;
  /** When true, bootstrap finished — safe to seed from `initialLayout` or fetch preferences. */
  layoutReady?: boolean;
}) {
  const [layout, setLayout] = useState<DashboardOverviewLayout>(
    () => initialLayout ?? DEFAULT_OVERVIEW_LAYOUT,
  );
  const [isCustom, setIsCustom] = useState(initialIsCustom);
  const [loading, setLoading] = useState(!layoutReady && initialLayout == null);
  const hasSeededLayoutRef = useRef(initialLayout != null);

  useEffect(() => {
    if (hasSeededLayoutRef.current) return;
    if (!layoutReady) return;

    if (initialLayout) {
      setLayout(sanitizeDashboardOverviewLayout(initialLayout));
      setIsCustom(initialIsCustom);
      setLoading(false);
      hasSeededLayoutRef.current = true;
      return;
    }

    let cancelled = false;
    fetch('/api/dashboard/overview-preferences', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { layout?: DashboardOverviewLayout; isCustom?: boolean } | null) => {
        if (cancelled || !data?.layout) return;
        setLayout(sanitizeDashboardOverviewLayout(data.layout));
        setIsCustom(data.isCustom === true);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          hasSeededLayoutRef.current = true;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialLayout, initialIsCustom, layoutReady]);

  const persist = useCallback(async (next: DashboardOverviewLayout, reset = false) => {
    const response = await fetch('/api/dashboard/overview-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(reset ? { reset: true } : { layout: next }),
    });
    const data = (await response.json()) as {
      layout?: DashboardOverviewLayout;
      isCustom?: boolean;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error || 'Failed to save dashboard layout');
    }
    if (data.layout) {
      setLayout(sanitizeDashboardOverviewLayout(data.layout));
      setIsCustom(data.isCustom === true);
    }
  }, []);

  const handleToggleWidgetPin = useCallback(
    async (widgetId: OverviewWidgetId) => {
      let previousLayout: DashboardOverviewLayout | null = null;
      let nextLayout: DashboardOverviewLayout | null = null;
      setLayout((current) => {
        previousLayout = current;
        nextLayout = toggleWidgetPin(current, widgetId);
        return nextLayout;
      });
      setIsCustom(true);
      try {
        await persist(nextLayout!);
      } catch {
        if (previousLayout) setLayout(previousLayout);
      }
    },
    [persist],
  );

  const handleToggleKpiPin = useCallback(
    async (domainId: DashboardModuleDomainId) => {
      let previousLayout: DashboardOverviewLayout | null = null;
      let nextLayout: DashboardOverviewLayout | null = null;
      setLayout((current) => {
        previousLayout = current;
        nextLayout = toggleKpiPin(current, domainId);
        return nextLayout;
      });
      setIsCustom(true);
      try {
        await persist(nextLayout!);
      } catch {
        if (previousLayout) setLayout(previousLayout);
      }
    },
    [persist],
  );

  const handleToggleWidgetHidden = useCallback(
    async (widgetId: OverviewWidgetId) => {
      let previousLayout: DashboardOverviewLayout | null = null;
      let nextLayout: DashboardOverviewLayout | null = null;
      setLayout((current) => {
        previousLayout = current;
        nextLayout = toggleWidgetHidden(current, widgetId);
        return nextLayout;
      });
      setIsCustom(true);
      try {
        await persist(nextLayout!);
      } catch {
        if (previousLayout) setLayout(previousLayout);
      }
    },
    [persist],
  );

  const resetLayout = useCallback(async () => {
    await persist(DEFAULT_OVERVIEW_LAYOUT, true);
  }, [persist]);

  const value = useMemo(
    () => ({
      layout,
      isCustom,
      loading,
      toggleWidgetPin: handleToggleWidgetPin,
      toggleWidgetHidden: handleToggleWidgetHidden,
      toggleKpiPin: handleToggleKpiPin,
      isWidgetPinned: (widgetId: OverviewWidgetId) => (layout.pinnedWidgets ?? []).includes(widgetId),
      isKpiPinned: (domainId: DashboardModuleDomainId) => (layout.pinnedKpis ?? []).includes(domainId),
      resetLayout,
    }),
    [layout, isCustom, loading, handleToggleWidgetPin, handleToggleWidgetHidden, handleToggleKpiPin, resetLayout],
  );

  return (
    <DashboardOverviewLayoutContext.Provider value={value}>
      {children}
    </DashboardOverviewLayoutContext.Provider>
  );
}

export function useDashboardOverviewLayout(): DashboardOverviewLayoutContextValue {
  const context = useContext(DashboardOverviewLayoutContext);
  if (!context) {
    throw new Error('useDashboardOverviewLayout must be used within DashboardOverviewLayoutProvider');
  }
  return context;
}
