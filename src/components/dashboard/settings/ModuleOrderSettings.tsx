'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, GripVertical, Loader2, RotateCcw } from 'lucide-react';
import { useDashboardModuleOrder } from '@/contexts/dashboard-module-order';
import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import { domainReadinessDotClass } from '@/lib/dashboard-nav-readiness';

export function ModuleOrderSettings() {
  const { orderedDomains, isCustom, loading, moveModule, resetModuleOrder } = useDashboardModuleOrder();
  const [savingId, setSavingId] = useState<DashboardModuleDomainId | null>(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMove = async (id: DashboardModuleDomainId, direction: 'up' | 'down') => {
    setError(null);
    setSavingId(id);
    try {
      await moveModule(id, direction);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update module order');
    } finally {
      setSavingId(null);
    }
  };

  const handleReset = async () => {
    setError(null);
    setResetting(true);
    try {
      await resetModuleOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset module order');
    } finally {
      setResetting(false);
    }
  };

  return (
    <section id="modules" className="dashboard-surface shadow-sm p-5 sm:p-6 space-y-4 scroll-mt-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Module order</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Reorder the module switcher in the top bar. New users get a role-based default until you
            customize it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={resetting || loading || !isCustom}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {resetting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Reset to role default
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <ol className="space-y-2">
          {orderedDomains.map((domain, index) => {
            const Icon = domain.icon;
            const busy = savingId === domain.id;
            return (
              <li
                key={domain.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5"
              >
                <GripVertical className="h-4 w-4 flex-shrink-0 text-neutral-300" aria-hidden />
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100">
                  <Icon className="h-4 w-4 text-neutral-600" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink">{domain.shortLabel}</p>
                    <span
                      className={`h-2 w-2 rounded-full ${domainReadinessDotClass(domain.readiness)}`}
                      aria-hidden
                    />
                  </div>
                  <p className="truncate text-xs text-neutral-500">{domain.description}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleMove(domain.id, 'up')}
                    disabled={index === 0 || busy || resetting}
                    className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
                    aria-label={`Move ${domain.shortLabel} up`}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUp className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMove(domain.id, 'down')}
                    disabled={index === orderedDomains.length - 1 || busy || resetting}
                    className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
                    aria-label={`Move ${domain.shortLabel} down`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-xs text-neutral-500">
        Changes apply to the{' '}
        <Link href="/dashboard" className="font-medium text-primary-700 hover:text-primary-800">
          command center
        </Link>{' '}
        module grid and sidebar module list too.
      </p>
    </section>
  );
}
