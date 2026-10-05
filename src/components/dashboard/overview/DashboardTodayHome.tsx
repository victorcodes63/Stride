'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatBadge, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import type { CrossModuleKpi, OverviewShortcut } from '@/lib/dashboard-overview-personalization';
import type { OverviewAttentionItem } from '@/lib/dashboard-attention/types';

/**
 * Calm daily home: greeting hero, four numbers that matter today, one attention list,
 * quick actions and a compact cross-business row. Empty states collapse to a
 * single quiet line instead of whole panels.
 */

export type TodayStat = {
  label: string;
  value: number | string;
  caption: string;
  href: string;
  icon: LucideIcon;
  tone?: 'default' | 'attention';
};

type DashboardTodayHomeProps = {
  greeting: string;
  dateLabel: string;
  entityName: string;
  roleLabel: string;
  subtitle?: string;
  primaryAction: {
    href: string;
    label: string;
    icon: LucideIcon;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    href: string;
    label: string;
    icon: LucideIcon;
    variant?: 'primary' | 'secondary';
  } | null;
  stats: TodayStat[];
  attentionItems: OverviewAttentionItem[];
  shortcuts: OverviewShortcut[];
  businessKpis: CrossModuleKpi[];
  loading: boolean;
};

const TONE_DOT: Record<OverviewAttentionItem['tone'], string> = {
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  neutral: 'bg-[var(--dash-text-faint)]',
};

function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] ${className}`}
    >
      <header className="flex items-center justify-between px-5 pb-1 pt-5 sm:px-6">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--dash-text-strong)]">{title}</h2>
        {action ? (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-strong)]"
          >
            {action.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function DashboardTodayHome({
  greeting,
  dateLabel,
  subtitle,
  primaryAction,
  secondaryAction,
  stats,
  attentionItems,
  shortcuts,
  businessKpis,
  loading,
}: DashboardTodayHomeProps) {
  const topAttention = attentionItems.slice(0, 3);
  const description =
    subtitle ??
    (attentionItems.length > 0
      ? `${attentionItems.length} thing${attentionItems.length === 1 ? '' : 's'} could use your attention today.`
      : 'Everything is on track today.');

  const meta = dateLabel || undefined;

  const headerActions = [
    {
      href: primaryAction.href,
      label: primaryAction.label,
      icon: primaryAction.icon,
      variant: (primaryAction.variant ?? 'primary') as 'primary' | 'secondary',
    },
    ...(secondaryAction
      ? [
          {
            href: secondaryAction.href,
            label: secondaryAction.label,
            icon: secondaryAction.icon,
            variant: (secondaryAction.variant ?? 'secondary') as 'primary' | 'secondary',
          },
        ]
      : []),
  ];

  return (
    <div className="page-shell space-y-8 pb-12">
      <DashboardPageHeader
        variant="hero"
        icon={false}
        title={greeting}
        description={description}
        meta={meta}
        actions={headerActions}
        titleSuppressHydrationWarning
        metaSuppressHydrationWarning
        className="!p-4 sm:!p-5"
      />

      {loading ? (
        <DashboardStatGrid columns={4}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-[152px] rounded-2xl" />
          ))}
        </DashboardStatGrid>
      ) : (
        <DashboardStatGrid columns={4}>
          {stats.slice(0, 4).map((stat) => (
            <DashboardStatBadge
              key={stat.label}
              label={stat.label}
              value={stat.value}
              hint={stat.caption}
              href={stat.href}
              icon={stat.icon}
              attention={stat.tone === 'attention' && Number(stat.value) > 0}
            />
          ))}
        </DashboardStatGrid>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <Panel
          title="Needs your attention"
          action={{ href: '/dashboard/attention', label: 'View all' }}
          className="xl:col-span-8"
        >
          {loading ? (
            <div className="space-y-2 p-5 sm:p-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="skeleton h-14 rounded-xl" />
              ))}
            </div>
          ) : topAttention.length === 0 ? (
            <div className="flex items-center gap-3 px-5 pb-5 pt-3 sm:px-6">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <p className="text-[14px] text-[var(--dash-text-muted)]">
                You&apos;re all caught up. Nothing is waiting on you right now.
              </p>
            </div>
          ) : (
            <ul className="px-2 pb-2 pt-1 sm:px-3">
              {topAttention.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--dash-hover)]"
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[item.tone]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-[var(--dash-text-strong)]">{item.label}</p>
                      <p className="mt-0.5 truncate text-[13px] text-[var(--dash-text-muted)]">{item.detail}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--dash-text-faint)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Jump in" className="xl:col-span-4">
          <ul className="px-2 pb-2 pt-1 sm:px-3">
            {shortcuts.slice(0, 4).map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--dash-hover)]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--dash-surface-muted)] text-[var(--dash-text-muted)]">
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-[var(--dash-text-strong)]">{item.label}</p>
                      <p className="truncate text-[12px] text-[var(--dash-text-muted)]">{item.desc}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--dash-text-faint)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {!loading && businessKpis.length > 0 ? (
        <Panel title="Across the business">
          <div className="grid grid-cols-2 gap-px border-t border-[var(--dash-border-subtle)] bg-[var(--dash-border-subtle)] sm:grid-cols-3 lg:grid-cols-4">
            {businessKpis.slice(0, 8).map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Link
                  key={kpi.domainId}
                  href={kpi.href}
                  className="flex items-start gap-3 bg-[var(--dash-surface-solid)] px-5 py-4 transition-colors hover:bg-[var(--dash-hover)] sm:px-6"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--dash-surface-muted)] text-[var(--dash-text-muted)]">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-[var(--dash-text-muted)]">{kpi.label}</p>
                    <p className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--dash-text-strong)]">
                      {kpi.value}
                    </p>
                    {kpi.note ? (
                      <p className="mt-0.5 truncate text-[12px] text-[var(--dash-text-subtle)]">{kpi.note}</p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </Panel>
      ) : null}

      {!loading && attentionItems.length === 0 && businessKpis.length === 0 ? (
        <div className="flex items-center justify-center py-4 text-[13px] text-[var(--dash-text-subtle)]">
          Quiet day — enjoy it.
        </div>
      ) : null}
    </div>
  );
}
