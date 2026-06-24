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
  DEFAULT_OVERVIEW_LAYOUT,
  type DashboardOverviewLayout,
  type OverviewWidgetId,
  toggleKpiPin,
  toggleWidgetPin,
  toggleWidgetHidden,
  sanitizeDashboardOverviewLayout,
} from '@/lib/dashboard-overview-preferences';
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

export function DashboardOverviewLayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<DashboardOverviewLayout>(DEFAULT_OVERVIEW_LAYOUT);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard/overview-preferences', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { layout?: DashboardOverviewLayout; isCustom?: boolean } | null) => {
        if (cancelled || !data?.layout) return;
        setLayout(sanitizeDashboardOverviewLayout(data.layout));
        setIsCustom(data.isCustom === true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      const previous = layout;
      const next = toggleWidgetPin(layout, widgetId);
      setLayout(next);
      setIsCustom(true);
      try {
        await persist(next);
      } catch {
        setLayout(previous);
      }
    },
    [layout, persist],
  );

  const handleToggleKpiPin = useCallback(
    async (domainId: DashboardModuleDomainId) => {
      const previous = layout;
      const next = toggleKpiPin(layout, domainId);
      setLayout(next);
      setIsCustom(true);
      try {
        await persist(next);
      } catch {
        setLayout(previous);
      }
    },
    [layout, persist],
  );

  const handleToggleWidgetHidden = useCallback(
    async (widgetId: OverviewWidgetId) => {
      const previous = layout;
      const next = toggleWidgetHidden(layout, widgetId);
      setLayout(next);
      setIsCustom(true);
      try {
        await persist(next);
      } catch {
        setLayout(previous);
      }
    },
    [layout, persist],
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
