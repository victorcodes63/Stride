'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarOff,
  Clock,
  Receipt,
  ShoppingCart,
  Target,
  Truck,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { OverviewWidgetHeader } from '@/components/dashboard/overview/OverviewWidgetHeader';
import type { OverviewAttentionItem } from '@/lib/dashboard-overview-personalization';
import type {
  DashboardModuleDomain,
  DashboardModuleDomainId,
} from '@/lib/dashboard-module-domains';

const ITEM_ICONS: Record<string, LucideIcon> = {
  leave: CalendarOff,
  attendance: Clock,
  credentials: BadgeCheck,
  onboarding: UserPlus,
  notifications: Bell,
  invoices: Receipt,
  'vendor-bills': Receipt,
  'purchase-requests': ShoppingCart,
  'fleet-incidents': Truck,
  'sales-past-due': Target,
  'sales-stalled': Target,
};

function toneAccent(tone: OverviewAttentionItem['tone']) {
  if (tone === 'rose') {
    return {
      bar: 'bg-rose-500',
      well: 'bg-rose-50 text-rose-700 dark:bg-rose-950/45 dark:text-rose-200',
      chip: 'bg-rose-100 text-rose-800 dark:bg-rose-950/55 dark:text-rose-200',
      wash: 'hover:bg-rose-50/70 dark:hover:bg-rose-950/25',
    };
  }
  if (tone === 'amber') {
    return {
      bar: 'bg-amber-500',
      well: 'bg-amber-50 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200',
      chip: 'bg-amber-100 text-amber-900 dark:bg-amber-950/55 dark:text-amber-200',
      wash: 'hover:bg-amber-50/70 dark:hover:bg-amber-950/20',
    };
  }
  if (tone === 'sky') {
    return {
      bar: 'bg-sky-500',
      well: 'bg-sky-50 text-sky-800 dark:bg-sky-950/45 dark:text-sky-200',
      chip: 'bg-sky-100 text-sky-900 dark:bg-sky-950/55 dark:text-sky-200',
      wash: 'hover:bg-sky-50/70 dark:hover:bg-sky-950/20',
    };
  }
  return {
    bar: 'bg-[var(--dash-border)]',
    well: 'bg-[var(--dash-surface-muted)] text-[var(--dash-text-muted)]',
    chip: 'bg-[var(--dash-surface-muted)] text-[var(--dash-text-subtle)]',
    wash: 'hover:bg-[var(--dash-hover)]',
  };
}

function extractCount(detail: string): number | null {
  const match = detail.match(/(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function AttentionItemCard({ item }: { item: OverviewAttentionItem }) {
  const Icon = ITEM_ICONS[item.id] ?? AlertTriangle;
  const accent = toneAccent(item.tone);
  const count = extractCount(item.detail);

  return (
    <Link
      href={item.href}
      className={`group relative flex items-start gap-3 overflow-hidden rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-solid)] px-3 py-3 transition ${accent.wash}`}
    >
      <span className={`absolute inset-y-2 left-0 w-0.5 rounded-full ${accent.bar}`} aria-hidden />
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent.well}`}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--dash-text-strong)]">{item.label}</p>
          {count != null ? (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${accent.chip}`}
            >
              {count}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--dash-text-muted)]">{item.detail}</p>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--dash-text-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--dash-text-muted)]" />
    </Link>
  );
}

export function NeedsAttentionSection({
  items,
  domains,
  attentionByDomain,
}: {
  items: OverviewAttentionItem[];
  domains: DashboardModuleDomain[];
  attentionByDomain: Partial<Record<DashboardModuleDomainId, OverviewAttentionItem[]>>;
}) {
  const urgency = useMemo(() => {
    let rose = 0;
    let amber = 0;
    for (const item of items) {
      if (item.tone === 'rose') rose += 1;
      else if (item.tone === 'amber') amber += 1;
    }
    return { rose, amber };
  }, [items]);

  const activeDomains = domains.filter((d) => (attentionByDomain[d.id]?.length ?? 0) > 0);
  const multiColumn = activeDomains.length > 1;

  const description =
    urgency.rose > 0
      ? `${urgency.rose} critical · ${items.length} total across ${activeDomains.length} module${
          activeDomains.length === 1 ? '' : 's'
        }`
      : `${items.length} item${items.length === 1 ? '' : 's'} across ${activeDomains.length} module${
          activeDomains.length === 1 ? '' : 's'
        }`;

  return (
    <section className="dashboard-panel group/pin-target overflow-hidden">
      <OverviewWidgetHeader
        widgetId="attention"
        title="Needs attention now"
        description={description}
        trailing={
          <span className="inline-flex items-center gap-1.5">
            {urgency.rose > 0 ? (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                {urgency.rose} critical
              </span>
            ) : null}
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              {items.length}
            </span>
          </span>
        }
      />

      <div
        className={`grid gap-3 px-2 py-3 sm:px-3 ${
          multiColumn ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'
        }`}
      >
        {activeDomains.map((domain) => {
          const domainItems = attentionByDomain[domain.id] ?? [];
          const DomainIcon = domain.icon;
          return (
            <div
              key={domain.id}
              className="overflow-hidden rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-muted)]/35"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[var(--dash-border-subtle)] px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="dash-icon-well flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
                    <DomainIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--dash-text-subtle)]">
                      {domain.shortLabel}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-[var(--dash-surface-solid)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--dash-text-muted)] ring-1 ring-[var(--dash-border-subtle)]">
                  {domainItems.length}
                </span>
              </div>
              <div className="space-y-2 p-2.5">
                {domainItems.map((item) => (
                  <AttentionItemCard key={item.id} item={item} />
                ))}
              </div>
              <div className="border-t border-[var(--dash-border-subtle)] px-3 py-2">
                <Link
                  href={domain.hubHref}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--dash-text-muted)] transition hover:text-primary-700 dark:hover:text-primary-400"
                >
                  Open {domain.shortLabel}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
