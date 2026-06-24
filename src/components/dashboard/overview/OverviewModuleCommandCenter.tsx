'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { type DashboardModuleDomain } from '@/lib/dashboard-module-domains';
import { useDashboardModuleOrder } from '@/contexts/dashboard-module-order';
import type { OverviewAttentionItem, OverviewDomainSnapshot } from '@/lib/dashboard-overview-personalization';
import { OverviewWidgetHeader } from '@/components/dashboard/overview/OverviewWidgetHeader';
import { domainReadinessDotClass } from '@/lib/dashboard-nav-readiness';

type OverviewModuleCommandCenterProps = {
  attentionByDomain: Partial<Record<string, OverviewAttentionItem[]>>;
  domainSnapshots: OverviewDomainSnapshot[];
};

function ModuleRow({
  domain,
  items,
  snapshotLines,
}: {
  domain: DashboardModuleDomain;
  items: OverviewAttentionItem[];
  snapshotLines: string[];
}) {
  const Icon = domain.icon;
  const needsAction = items.length > 0;

  return (
    <Link href={domain.hubHref} className="dash-overview-module-link group">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="dash-icon-well flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <p className="truncate text-sm font-semibold text-[var(--dash-text-strong)]">{domain.shortLabel}</p>
        </div>
        {needsAction ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            {items.length}
          </span>
        ) : (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="All clear" />
        )}
      </div>
      {needsAction ? (
        <ul className="space-y-0.5 pl-[2.625rem]">
          {items.slice(0, 2).map((item) => (
            <li key={item.id} className="truncate text-[11px] leading-snug text-[var(--dash-text-muted)]">
              <span className="font-medium text-[var(--dash-text-body)]">{item.label}</span>
              <span> — {item.detail}</span>
            </li>
          ))}
          {items.length > 2 ? (
            <li className="text-[11px] font-medium text-primary-700">+{items.length - 2} more</li>
          ) : null}
        </ul>
      ) : (
        <p className="truncate pl-[2.625rem] text-[11px] text-[var(--dash-text-muted)]">
          {snapshotLines[0] ?? 'Open module'}
        </p>
      )}
      <span className="mt-auto inline-flex items-center gap-1 pl-[2.625rem] text-[11px] font-medium text-primary-700 opacity-0 transition group-hover:opacity-100">
        Open
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}

export function OverviewModuleCommandCenter({
  attentionByDomain,
  domainSnapshots,
}: OverviewModuleCommandCenterProps) {
  const { orderedDomains } = useDashboardModuleOrder();
  const snapshotByDomain = Object.fromEntries(domainSnapshots.map((s) => [s.domainId, s.lines]));

  return (
    <section className="dashboard-panel group/pin-target overflow-hidden">
      <OverviewWidgetHeader
        widgetId="command-center"
        title="Across your business"
        description="What needs you today, by module — use the module switcher to change context."
        trailing={
          <p className="flex items-center gap-3 text-[10px] text-[var(--dash-text-subtle)]">
            <span className="inline-flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${domainReadinessDotClass('live')}`} />
              Live
            </span>
            <span className="inline-flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${domainReadinessDotClass('partial')}`} />
              Partial
            </span>
          </p>
        }
      />
      <div className="dash-overview-hairline-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {orderedDomains.map((domain) => (
          <ModuleRow
            key={domain.id}
            domain={domain}
            items={attentionByDomain[domain.id] ?? []}
            snapshotLines={snapshotByDomain[domain.id] ?? ['Open module']}
          />
        ))}
      </div>
    </section>
  );
}
