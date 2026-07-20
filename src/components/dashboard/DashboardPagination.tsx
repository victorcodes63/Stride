'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export type DashboardPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Optional label for the item type, e.g. "assets". Defaults to "results". */
  itemLabel?: string;
  className?: string;
};

/** Shared pagination footer for server- or client-paginated dashboard tables. */
export function DashboardPagination({
  page,
  pageSize,
  total,
  onPageChange,
  itemLabel = 'results',
  className,
}: DashboardPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const to = Math.min(clampedPage * pageSize, total);

  if (total <= pageSize) {
    return total > 0 ? (
      <div
        className={`flex items-center justify-between px-4 py-3 text-xs text-[var(--dash-text-muted)] ${className ?? ''}`}
      >
        <span>
          {total} {itemLabel}
        </span>
      </div>
    ) : null;
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-[var(--dash-text-muted)] ${className ?? ''}`}
    >
      <span>
        Showing <span className="font-medium text-[var(--dash-text)]">{from}</span>–
        <span className="font-medium text-[var(--dash-text)]">{to}</span> of{' '}
        <span className="font-medium text-[var(--dash-text)]">{total}</span> {itemLabel}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(clampedPage - 1)}
          disabled={clampedPage <= 1}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--dash-border)] px-2.5 font-medium text-[var(--dash-text)] hover:bg-[var(--dash-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <span className="px-2 tabular-nums">
          Page {clampedPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(clampedPage + 1)}
          disabled={clampedPage >= totalPages}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--dash-border)] px-2.5 font-medium text-[var(--dash-text)] hover:bg-[var(--dash-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
