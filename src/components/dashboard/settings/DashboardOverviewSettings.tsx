'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Pin, RotateCcw } from 'lucide-react';
import { useDashboardOverviewLayout } from '@/contexts/dashboard-overview-layout';
import {
  FULL_WIDTH_OVERVIEW_WIDGETS,
  OVERVIEW_WIDGET_IDS,
  SIDEBAR_OVERVIEW_WIDGETS,
  type OverviewWidgetId,
} from '@/lib/dashboard-overview-preferences';
import { DASHBOARD_MODULE_DOMAINS } from '@/lib/dashboard-module-domains';

const WIDGET_LABELS: Record<OverviewWidgetId, string> = {
  'command-center': 'Across your business',
  attention: 'Needs attention',
  snapshot: 'Business snapshot',
  'hr-details': 'HR & Payroll details',
  shortcuts: 'Jump to a module',
  notifications: 'Recent updates',
  credentials: 'Credential compliance',
};

export function DashboardOverviewSettings() {
  const { layout, isCustom, loading, isWidgetPinned, isKpiPinned, toggleWidgetPin, toggleWidgetHidden, toggleKpiPin, resetLayout } =
    useDashboardOverviewLayout();
  const [resetting, setResetting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const persistHiddenToggle = async (widgetId: OverviewWidgetId) => {
    setError(null);
    setSavingId(widgetId);
    try {
      await toggleWidgetHidden(widgetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update layout');
    } finally {
      setSavingId(null);
    }
  };

  const handleReset = async () => {
    setError(null);
    setResetting(true);
    try {
      await resetLayout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset dashboard layout');
    } finally {
      setResetting(false);
    }
  };

  return (
    <section id="dashboard-layout" className="dashboard-surface scroll-mt-24 space-y-4 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Dashboard layout</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Pin sections and KPI tiles on your home dashboard. Each user keeps their own layout — sidebar link pins
            are separate.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={resetting || loading || !isCustom}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Reset to default
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <div>
            <h3 className="text-sm font-semibold text-ink">Sections</h3>
            <ul className="mt-2 space-y-2">
              {OVERVIEW_WIDGET_IDS.map((widgetId) => {
                const pinned = isWidgetPinned(widgetId);
                const hidden = (layout.hiddenWidgets ?? []).includes(widgetId);
                const busy = savingId === widgetId;
                return (
                  <li
                    key={widgetId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{WIDGET_LABELS[widgetId]}</p>
                      <p className="text-xs text-neutral-500">
                        {FULL_WIDTH_OVERVIEW_WIDGETS.includes(widgetId)
                          ? 'Main column'
                          : SIDEBAR_OVERVIEW_WIDGETS.includes(widgetId)
                            ? 'Sidebar'
                            : 'Details column'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleWidgetPin(widgetId)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border ${
                          pinned ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                        }`}
                        title={pinned ? 'Unpin section' : 'Pin section'}
                        aria-label={pinned ? 'Unpin section' : 'Pin section'}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void persistHiddenToggle(widgetId)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border ${
                          hidden ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                        }`}
                        title={hidden ? 'Show section' : 'Hide section'}
                        aria-label={hidden ? 'Show section' : 'Hide section'}
                      >
                        {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink">Business snapshot tiles</h3>
            <ul className="mt-2 space-y-2">
              {DASHBOARD_MODULE_DOMAINS.map((domain) => {
                const pinned = isKpiPinned(domain.id);
                return (
                  <li
                    key={domain.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2.5"
                  >
                    <p className="text-sm font-medium text-ink">{domain.shortLabel}</p>
                    <button
                      type="button"
                      onClick={() => void toggleKpiPin(domain.id)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border ${
                        pinned ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                      }`}
                      title={pinned ? 'Unpin KPI tile' : 'Pin KPI tile'}
                      aria-label={pinned ? 'Unpin KPI tile' : 'Pin KPI tile'}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="text-sm text-neutral-500">
            Tip: hover any section on{' '}
            <Link href="/dashboard" className="font-medium text-primary-700 hover:text-primary-800">
              your dashboard
            </Link>{' '}
            and use the pin icon for quick changes.
          </p>
        </>
      )}
    </section>
  );
}
