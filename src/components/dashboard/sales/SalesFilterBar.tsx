'use client';

import { type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { StrideSelect } from '@/components/ui/stride-select';

export type FilterSelect = {
  id: string;
  value: string;
  ariaLabel: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
};

type SalesFilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  selects?: FilterSelect[];
  right?: ReactNode;
  resultCount?: number;
};

/**
 * Toolbar strip above Sales tables/boards: debounce-free search input, a set of
 * faceted select filters, and an optional right-aligned actions slot.
 */
export function SalesFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  selects = [],
  right,
  resultCount,
}: SalesFilterBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[13rem] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dash-text-muted)]" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] pl-9 pr-8 text-sm text-[var(--dash-text-strong)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--stride-coral)]/30"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {selects.map((s) => (
        <StrideSelect
          key={s.id}
          value={s.value}
          onChange={s.onChange}
          options={s.options}
          ariaLabel={s.ariaLabel}
          className="min-w-[9rem]"
        />
      ))}
      {typeof resultCount === 'number' ? (
        <span className="text-xs text-[var(--dash-text-muted)]">{resultCount} result{resultCount === 1 ? '' : 's'}</span>
      ) : null}
      {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
    </div>
  );
}
