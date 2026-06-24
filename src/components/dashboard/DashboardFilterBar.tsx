'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { DASHBOARD_TOOLBAR_CLASS } from '@/lib/dashboard-layout';

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export function DashboardFilterBar({
  children,
  onClear,
  hasActiveFilters,
  label,
  className,
}: {
  children: ReactNode;
  onClear?: () => void;
  hasActiveFilters?: boolean;
  label?: string | null;
  className?: string;
}) {
  return (
    <div className={cn(DASHBOARD_TOOLBAR_CLASS, 'px-4 py-3 sm:px-5', className)}>
      {label ? (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {hasActiveFilters && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="dash-filter-clear inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Standard select styling for filter bars and table toolbars. */
export const dashboardFilterSelectClass =
  'dash-filter-select rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30';
