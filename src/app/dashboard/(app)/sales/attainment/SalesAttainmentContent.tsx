'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Gauge, Medal, Target, Trophy, Wallet } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatGrid, DashboardMetricCard } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardAsyncState,
  DashboardEmptyState,
  DashboardPageSkeleton,
} from '@/components/dashboard/DashboardAsyncState';
import { useSalesResource, salesKeys } from '@/lib/sales/hooks';
import { formatCompactCurrency, formatPercent, formatSalesCurrency } from '@/lib/sales/format';

type RepRow = {
  employeeId?: string;
  employeeName: string;
  departmentName: string | null;
  target: number;
  actual: number;
  attainmentPct: number | null;
  pacingPct: number | null;
  currency: string;
};

type Report = {
  periodStart: string;
  periodEnd: string;
  currency: string;
  teamTotals: { target: number; actual: number; attainmentPct: number | null };
  leaderboard: RepRow[];
};

type SortKey = 'attainment' | 'actual' | 'target' | 'pacing';

/** Fraction (0-100) of the period that has elapsed as of now. */
function periodProgressPct(startIso: string, endIso: string, now = new Date()): number {
  const start = new Date(`${startIso}T00:00:00.000Z`).getTime();
  const end = new Date(`${endIso}T00:00:00.000Z`).getTime() + 86400000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const t = now.getTime();
  if (t <= start) return 0;
  if (t >= end) return 100;
  return Math.round(((t - start) / (end - start)) * 1000) / 10;
}

type Pace = { label: string; tone: string; barTone: string };

function paceFor(attainmentPct: number | null, progress: number): Pace {
  if (attainmentPct == null) {
    return {
      label: 'No quota',
      tone: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:ring-slate-500/20',
      barTone: 'bg-slate-300 dark:bg-slate-600',
    };
  }
  const delta = attainmentPct - progress;
  if (delta >= 5) {
    return {
      label: 'Ahead',
      tone: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20',
      barTone: 'bg-emerald-500',
    };
  }
  if (delta <= -5) {
    return {
      label: 'Behind',
      tone: 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/20',
      barTone: 'bg-rose-500',
    };
  }
  return {
    label: 'On track',
    tone: 'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/20',
    barTone: 'bg-sky-500',
  };
}

const RANK_MEDAL: Record<number, string> = {
  0: 'text-amber-500',
  1: 'text-slate-400',
  2: 'text-amber-700',
};

export default function SalesAttainmentContent() {
  const query = useSalesResource<{ report: Report }>(salesKeys.attainment(), '/api/sales/attainment');
  const report = query.data?.report;

  const [sortKey, setSortKey] = useState<SortKey>('attainment');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const progress = report ? periodProgressPct(report.periodStart, report.periodEnd) : 0;
  const currency = report?.currency ?? 'KES';

  const sortedRows = useMemo(() => {
    const rows = [...(report?.leaderboard ?? [])];
    const val = (r: RepRow) => {
      switch (sortKey) {
        case 'actual':
          return r.actual;
        case 'target':
          return r.target;
        case 'pacing':
          return r.pacingPct ?? -1;
        default:
          return r.attainmentPct ?? -1;
      }
    };
    rows.sort((a, b) => (sortDir === 'desc' ? val(b) - val(a) : val(a) - val(b)));
    return rows;
  }, [report?.leaderboard, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const status = query.isLoading ? 'loading' : query.isError ? 'error' : 'success';

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Attainment & leaderboard"
        description="Real-time quota attainment per rep with pacing against elapsed period."
        icon={Trophy}
      />

      <DashboardAsyncState
        status={status}
        error={query.error?.message}
        onRetry={() => void query.refetch()}
        loading={<DashboardPageSkeleton variant="stats" />}
      >
        {!report || report.leaderboard.length === 0 ? (
          <DashboardEmptyState
            icon={Trophy}
            title="No attainment yet"
            description="Approve quotas and close deals to populate the leaderboard."
          />
        ) : (
          <div className="space-y-6">
            <DashboardStatGrid columns={4}>
              <DashboardMetricCard
                label="Team target"
                value={formatCompactCurrency(report.teamTotals.target, currency)}
                hint={`${report.periodStart} → ${report.periodEnd}`}
                icon={Target}
                tone="primary"
              />
              <DashboardMetricCard
                label="Team actual"
                value={formatCompactCurrency(report.teamTotals.actual, currency)}
                hint={`${report.leaderboard.length} reps`}
                icon={Wallet}
                tone="emerald"
              />
              <DashboardMetricCard
                label="Team attainment"
                value={
                  report.teamTotals.attainmentPct != null
                    ? `${report.teamTotals.attainmentPct}%`
                    : '—'
                }
                hint="of quota"
                icon={Gauge}
                tone="primary"
                highlighted
              />
              <DashboardMetricCard
                label="Period elapsed"
                value={`${progress}%`}
                hint="pace benchmark"
                icon={Gauge}
                tone="violet"
              />
            </DashboardStatGrid>

            <div className="dashboard-surface overflow-hidden shadow-sm">
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--dash-border)] px-4 py-3">
                <Trophy className="h-4 w-4 text-[var(--stride-coral)]" />
                <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Leaderboard</h2>
                <span className="ml-auto text-xs text-[var(--dash-text-muted)]">
                  {progress}% of period elapsed
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Rep</th>
                      <SortableHeader
                        label="Target"
                        active={sortKey === 'target'}
                        dir={sortDir}
                        onClick={() => toggleSort('target')}
                      />
                      <SortableHeader
                        label="Actual"
                        active={sortKey === 'actual'}
                        dir={sortDir}
                        onClick={() => toggleSort('actual')}
                      />
                      <SortableHeader
                        label="Attainment"
                        active={sortKey === 'attainment'}
                        dir={sortDir}
                        onClick={() => toggleSort('attainment')}
                      />
                      <SortableHeader
                        label="Pacing"
                        active={sortKey === 'pacing'}
                        dir={sortDir}
                        onClick={() => toggleSort('pacing')}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r, i) => {
                      const pct = r.attainmentPct;
                      const bar = pct != null ? Math.min(100, Math.max(0, pct)) : 0;
                      const pace = paceFor(pct, progress);
                      const barColor = pct != null && pct >= 100 ? 'bg-emerald-500' : 'bg-[var(--stride-coral)]';
                      return (
                        <tr
                          key={(r.employeeId ?? r.employeeName) + i}
                          className="border-t border-[var(--dash-border)] transition-colors hover:bg-[var(--dash-hover)]"
                        >
                          <td className="px-4 py-3">
                            {i < 3 ? (
                              <Medal className={`h-4 w-4 ${RANK_MEDAL[i]}`} />
                            ) : (
                              <span className="font-medium text-[var(--dash-text-muted)]">{i + 1}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-[var(--dash-text-strong)]">
                              {r.employeeName}
                            </div>
                            {r.departmentName ? (
                              <div className="text-xs text-[var(--dash-text-muted)]">
                                {r.departmentName}
                              </div>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[var(--dash-text-body)]">
                            {formatSalesCurrency(r.target, r.currency)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[var(--dash-text-body)]">
                            {formatSalesCurrency(r.actual, r.currency)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[var(--dash-text-strong)]">
                              {pct != null ? `${pct}%` : '—'}
                            </div>
                            <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-[var(--dash-surface-muted)]">
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${bar}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${pace.tone}`}
                            >
                              {pace.label}
                            </span>
                            <div className="mt-1 text-xs text-[var(--dash-text-muted)]">
                              {r.pacingPct != null ? `${r.pacingPct}% of pace` : '—'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </DashboardAsyncState>
    </DashboardPage>
  );
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-[var(--dash-text-strong)] ${
          active ? 'text-[var(--dash-text-strong)]' : ''
        }`}
      >
        {label}
        {active ? (
          dir === 'desc' ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUp className="h-3 w-3" />
          )
        ) : null}
      </button>
    </th>
  );
}
