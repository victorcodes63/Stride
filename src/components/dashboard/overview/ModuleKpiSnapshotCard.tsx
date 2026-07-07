'use client';

import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { OverviewKpiMiniChart } from '@/components/dashboard/overview/OverviewKpiMiniChart';
import type { OverviewKpiChartSegment } from '@/lib/dashboard-overview-personalization';

export type ModuleKpiSnapshotCardProps = {
  label: string;
  value: number | string;
  note: string;
  icon: LucideIcon;
  href: string;
  chartSegments: OverviewKpiChartSegment[];
  chartPlaceholder?: boolean;
};

export function ModuleKpiSnapshotCard({
  label,
  value,
  note,
  icon: Icon,
  href,
  chartSegments,
  chartPlaceholder = false,
}: ModuleKpiSnapshotCardProps) {
  return (
    <article className="dashboard-panel overflow-hidden p-4 sm:p-5">
      <Link href={href} className="group block">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-[var(--dash-text-muted)]" strokeWidth={1.75} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--dash-text-muted)]">
              {label}
            </p>
          </div>
          <ArrowUpRight
            className="h-3.5 w-3.5 text-[var(--dash-text-faint)] transition group-hover:text-primary-500"
            aria-hidden
          />
        </div>
        <OverviewKpiMiniChart segments={chartSegments} placeholder={chartPlaceholder} />
        <div className="mt-2 flex items-baseline gap-1.5">
          {!chartPlaceholder ? (
            <p className="dash-overview-kpi-value text-lg font-semibold leading-none tracking-tight tabular-nums text-[var(--dash-text-strong)]">
              {value}
            </p>
          ) : null}
          <p className="text-[11px] leading-snug text-[var(--dash-text-muted)]">{note}</p>
        </div>
      </Link>
    </article>
  );
}
