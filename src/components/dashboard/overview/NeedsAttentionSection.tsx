'use client';

import Link from 'next/link';
import { ArrowRight, Inbox } from 'lucide-react';
import type { OverviewAttentionItem } from '@/lib/dashboard-overview-personalization';

/**
 * Individual Action Center card for the Overview “getting into work” grid.
 */
export function NeedsAttentionSection({ items }: { items: OverviewAttentionItem[] }) {
  if (items.length === 0) return null;

  let critical = 0;
  for (const item of items) {
    if (item.tone === 'rose') critical += 1;
  }

  const ranked = [...items].sort((a, b) => {
    const rank = { rose: 0, amber: 1, sky: 2, neutral: 3 } as const;
    return rank[a.tone] - rank[b.tone];
  });
  const preview = ranked.slice(0, 4);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-solid)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--dash-border-subtle)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="dash-icon-well flex h-8 w-8 items-center justify-center rounded-lg">
              <Inbox className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">Action Center</h3>
                {critical > 0 ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                    {critical} critical
                  </span>
                ) : null}
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  {items.length} open
                </span>
              </div>
              <p className="text-[11px] text-[var(--dash-text-muted)]">Queues waiting on you</p>
            </div>
          </div>
        </div>
        <Link
          href="/dashboard/attention"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-800 dark:text-primary-400"
        >
          Open <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="flex min-h-0 flex-1 flex-col divide-y divide-[var(--dash-border-subtle)] px-1 py-1 sm:px-2">
        {preview.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className={`dash-overview-attention-row dash-overview-attention-row--${item.tone} group`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--dash-text-strong)]">{item.label}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--dash-text-muted)]">{item.detail}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--dash-text-faint)] transition group-hover:text-[var(--dash-text-muted)]" />
            </Link>
          </li>
        ))}
      </ul>

      {items.length > preview.length ? (
        <div className="border-t border-[var(--dash-border-subtle)] px-4 py-2">
          <Link
            href="/dashboard/attention"
            className="text-[11px] font-medium text-[var(--dash-text-muted)] hover:text-primary-700 dark:hover:text-primary-400"
          >
            +{items.length - preview.length} more queue{items.length - preview.length === 1 ? '' : 's'}
          </Link>
        </div>
      ) : (
        <div className="border-t border-[var(--dash-border-subtle)] px-4 py-2">
          <Link
            href="/dashboard/attention"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--dash-text-muted)] hover:text-primary-700 dark:hover:text-primary-400"
          >
            Work through them one by one
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
