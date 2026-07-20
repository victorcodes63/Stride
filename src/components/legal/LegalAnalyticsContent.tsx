'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Gavel,
  Layers,
  ListChecks,
  ShieldAlert,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardAsyncState,
  DashboardPageSkeleton,
  type DashboardAsyncStatus,
} from '@/components/dashboard/DashboardAsyncState';
import {
  SALES_CHART,
  SalesChartCard,
  SalesChartTooltip,
} from '@/components/dashboard/sales/SalesCharts';
import { STRIDE_DASHBOARD_SWATCHES } from '@/lib/platform-swatches';
import {
  CATEGORY_LABEL,
  OBLIGATION_CATEGORIES,
  OBLIGATION_PRIORITIES,
  PRIORITY_LABEL,
  STATUS_LABEL,
  type LegalObligationPriority,
  type LegalObligationStatus,
} from '@/lib/legal/constants';
import { LegalModuleTabs } from '@/components/legal/LegalHubTabs';
import type { LegalOverviewResponse } from '@/app/api/legal/overview/route';

const NEUTRAL = '#94A3B8';

const STATUS_COLOR: Record<LegalObligationStatus, string> = {
  pending: STRIDE_DASHBOARD_SWATCHES.amber.accent,
  completed: STRIDE_DASHBOARD_SWATCHES.emerald.accent,
  waived: NEUTRAL,
};

const PRIORITY_COLOR: Record<LegalObligationPriority, string> = {
  low: NEUTRAL,
  medium: STRIDE_DASHBOARD_SWATCHES.sky.accent,
  high: STRIDE_DASHBOARD_SWATCHES.amber.accent,
  critical: STRIDE_DASHBOARD_SWATCHES.rose.accent,
};

const RISK_META: Record<
  LegalOverviewResponse['risk']['level'],
  { label: string; text: string; color: string }
> = {
  low: { label: 'Low', text: 'text-emerald-700', color: STRIDE_DASHBOARD_SWATCHES.emerald.accent },
  moderate: { label: 'Moderate', text: 'text-sky-700', color: STRIDE_DASHBOARD_SWATCHES.sky.accent },
  elevated: { label: 'Elevated', text: 'text-amber-700', color: STRIDE_DASHBOARD_SWATCHES.amber.accent },
  high: { label: 'High', text: 'text-red-700', color: STRIDE_DASHBOARD_SWATCHES.rose.accent },
};

export function LegalAnalyticsContent() {
  const [data, setData] = useState<LegalOverviewResponse | null>(null);
  const [status, setStatus] = useState<DashboardAsyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/legal/overview', { cache: 'no-store' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      const json = (await res.json()) as LegalOverviewResponse;
      setData(json);
      setStatus('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load legal analytics.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statusData = useMemo(() => {
    if (!data) return [];
    return (Object.keys(data.obligations.byStatus) as LegalObligationStatus[])
      .map((key) => ({
        key,
        label: STATUS_LABEL[key],
        value: data.obligations.byStatus[key],
        color: STATUS_COLOR[key],
      }))
      .filter((d) => d.value > 0);
  }, [data]);

  const priorityData = useMemo(() => {
    if (!data) return [];
    return OBLIGATION_PRIORITIES.map((key) => ({
      key,
      label: PRIORITY_LABEL[key],
      value: data.obligations.byPriority[key],
      color: PRIORITY_COLOR[key],
    }));
  }, [data]);

  const categoryData = useMemo(() => {
    if (!data) return [];
    return OBLIGATION_CATEGORIES.map((key) => ({
      key,
      label: CATEGORY_LABEL[key],
      value: data.obligations.byCategory[key],
    })).filter((d) => d.value > 0);
  }, [data]);

  const risk = data ? RISK_META[data.risk.level] : null;

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={BarChart3}
        eyebrow="04 — Legal & Documents"
        title="Compliance analytics"
        description="Risk scoring, obligation mix, and the six-month due-load outlook."
        footer={<LegalModuleTabs active="analytics" />}
      />

      <DashboardAsyncState
        status={status}
        error={error}
        onRetry={() => void load()}
        loading={<DashboardPageSkeleton variant="stats" />}
      >
        {data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <section className="dashboard-surface flex flex-col justify-between p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
                  <ShieldAlert className="h-4 w-4 text-[var(--stride-coral)]" aria-hidden />
                  Compliance risk score
                </div>
                <div className="mt-4 flex items-end gap-3">
                  <span
                    className="text-5xl font-bold tabular-nums"
                    style={{ color: risk?.color }}
                  >
                    {data.risk.score}
                  </span>
                  <span className="pb-1 text-sm text-[var(--dash-text-muted)]">/ 100</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--dash-surface-muted)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${data.risk.score}%`, backgroundColor: risk?.color }}
                  />
                </div>
                <p className={`mt-3 text-sm font-medium ${risk?.text ?? ''}`}>
                  {risk?.label} risk · weighted by overdue, critical, and high-priority items.
                </p>
              </section>

              <section className="dashboard-surface flex flex-col justify-between p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
                  <AlertTriangle className="h-4 w-4 text-[var(--swatch-amber-fg)]" aria-hidden />
                  Overdue obligations
                </div>
                <p className="mt-4 text-5xl font-bold tabular-nums text-[var(--swatch-amber-fg)]">
                  {data.stats.overdueObligations}
                </p>
                <p className="mt-3 text-sm text-[var(--dash-text-muted)]">
                  {data.stats.dueSoonObligations} more due within their reminder window.
                </p>
              </section>

              <section className="dashboard-surface flex flex-col justify-between p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
                  <ListChecks className="h-4 w-4 text-[var(--stride-coral)]" aria-hidden />
                  Tracked obligations
                </div>
                <p className="mt-4 text-5xl font-bold tabular-nums text-[var(--dash-text-strong)]">
                  {data.obligations.total}
                </p>
                <p className="mt-3 text-sm text-[var(--dash-text-muted)]">
                  {data.obligations.byStatus.pending} pending · {data.obligations.byStatus.completed} completed ·{' '}
                  {data.obligations.byStatus.waived} waived
                </p>
              </section>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <SalesChartCard
                title="Obligation status mix"
                icon={Gavel}
                isEmpty={statusData.length === 0}
                emptyLabel="No obligations recorded yet."
              >
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={64}
                      outerRadius={104}
                      paddingAngle={2}
                      stroke="var(--dash-surface-solid)"
                      strokeWidth={2}
                    >
                      {statusData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<SalesChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap justify-center gap-3">
                  {statusData.map((entry) => (
                    <span key={entry.key} className="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)]">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      {entry.label} ({entry.value})
                    </span>
                  ))}
                </div>
              </SalesChartCard>

              <SalesChartCard
                title="Priority distribution"
                icon={Layers}
                isEmpty={priorityData.every((d) => d.value === 0)}
                emptyLabel="No obligations to prioritise."
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={priorityData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={SALES_CHART.gridStroke} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={SALES_CHART.axisTick}
                      tickLine={false}
                      axisLine={{ stroke: SALES_CHART.gridStroke }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={SALES_CHART.axisTick}
                      tickLine={false}
                      axisLine={{ stroke: SALES_CHART.gridStroke }}
                    />
                    <Tooltip content={<SalesChartTooltip />} cursor={{ fill: 'var(--dash-hover)' }} />
                    <Bar dataKey="value" name="Obligations" radius={[6, 6, 0, 0]} maxBarSize={56}>
                      {priorityData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SalesChartCard>

              <SalesChartCard
                title="Category distribution"
                icon={ListChecks}
                isEmpty={categoryData.length === 0}
                emptyLabel="No categorised obligations yet."
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={categoryData}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid horizontal={false} stroke={SALES_CHART.gridStroke} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={SALES_CHART.axisTick}
                      tickLine={false}
                      axisLine={{ stroke: SALES_CHART.gridStroke }}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={130}
                      tick={SALES_CHART.axisTick}
                      tickLine={false}
                      axisLine={{ stroke: SALES_CHART.gridStroke }}
                    />
                    <Tooltip content={<SalesChartTooltip />} cursor={{ fill: 'var(--dash-hover)' }} />
                    <Bar
                      dataKey="value"
                      name="Obligations"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={26}
                      fill={SALES_CHART.coral}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </SalesChartCard>

              <SalesChartCard
                title="Upcoming due load (6 months)"
                icon={CalendarClock}
                isEmpty={data.trend.every((t) => t.count === 0)}
                emptyLabel="Nothing due in the next six months."
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.trend} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={SALES_CHART.gridStroke} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={SALES_CHART.axisTick}
                      tickLine={false}
                      axisLine={{ stroke: SALES_CHART.gridStroke }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={SALES_CHART.axisTick}
                      tickLine={false}
                      axisLine={{ stroke: SALES_CHART.gridStroke }}
                    />
                    <Tooltip content={<SalesChartTooltip />} cursor={{ fill: 'var(--dash-hover)' }} />
                    <Bar
                      dataKey="count"
                      name="Items due"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                      fill={STRIDE_DASHBOARD_SWATCHES.violet.accent}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </SalesChartCard>
            </div>
          </div>
        ) : null}
      </DashboardAsyncState>
    </DashboardPage>
  );
}
