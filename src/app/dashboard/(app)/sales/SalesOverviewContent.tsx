'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BarChart3,
  CalendarClock,
  Coins,
  Filter,
  Gauge,
  Layers,
  Plus,
  Target,
  TimerReset,
  TrendingUp,
  Trophy,
  Wallet,
} from 'lucide-react';
import { ModuleHomeContent } from '@/components/dashboard/module-home/ModuleHomeContent';
import { DashboardPageSection } from '@/components/dashboard/DashboardPage';
import { DashboardStatGrid, DashboardMetricCard } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardAsyncState,
  DashboardPageSkeleton,
} from '@/components/dashboard/DashboardAsyncState';
import {
  SALES_CHART,
  SalesChartCard,
  SalesChartTooltip,
  SalesFunnelChart,
  STAGE_CHART_COLOR,
} from '@/components/dashboard/sales';
import { useSalesResource, salesKeys } from '@/lib/sales/hooks';
import {
  formatCompactCurrency,
  formatPercent,
  formatSalesCurrency,
} from '@/lib/sales/format';
import { stageLabel, type SalesDealStage } from '@/lib/sales/schema';

type SalesOverview = {
  periodStart: string;
  periodEnd: string;
  currency: string;
  teamTarget: number;
  closedRevenue: number;
  attainmentPct: number | null;
  weightedPipeline: number;
  coverage: number | null;
  dealsClosingThisPeriod: number;
  funnel: Array<{ stage: string; count: number; value: number }>;
  weekMovements: Array<{ fromStage: string | null; toStage: string; count: number }>;
  winRatePct: number | null;
  avgDealSize: number | null;
  avgSalesCycleDays: number | null;
  salesVelocity: number;
};

type StageConversion = {
  fromStage: string;
  toStage: string;
  fromCount: number;
  toCount: number;
  ratePct: number | null;
};

type TrendPoint = { month: string; won: number; created: number; wonValue: number };
type AgingBucket = { bucket: string; label: string; count: number; value: number };
type ActivityRow = {
  employeeId: string;
  employeeName: string;
  activities: number;
  dealsWon: number;
  closedValue: number;
};

type SalesAnalytics = {
  periodStart: string;
  periodEnd: string;
  currency: string;
  months: number;
  scope: 'team' | 'self';
  totalDeals: number;
  stageConversion: StageConversion[];
  funnel: Array<{ stage: string; count: number; value: number }>;
  monthlyTrend: TrendPoint[];
  dealAging: AgingBucket[];
  rotting: { count: number; value: number };
  repPerformance: Array<{
    employeeId: string;
    employeeName: string;
    dealsWon: number;
    dealsLost: number;
    openDeals: number;
    winRatePct: number | null;
    avgDealSize: number | null;
    closedValue: number;
    openValue: number;
  }>;
  activityLeaderboard: ActivityRow[];
};

const AGING_COLOR: Record<string, string> = {
  fresh: SALES_CHART.swatches.emerald.accent,
  aging: SALES_CHART.swatches.sky.accent,
  stale: SALES_CHART.swatches.violet.accent,
  cold: SALES_CHART.swatches.amber.accent,
  frozen: SALES_CHART.swatches.rose.accent,
};

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map((v) => Number.parseInt(v, 10));
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-KE', {
    month: 'short',
    year: '2-digit',
  });
}

export default function SalesOverviewContent() {
  const overviewQuery = useSalesResource<{ overview: SalesOverview }>(
    salesKeys.overview(),
    '/api/sales/overview',
  );
  const analyticsQuery = useSalesResource<{ analytics: SalesAnalytics }>(
    salesKeys.analytics(),
    '/api/sales/analytics',
  );

  const overview = overviewQuery.data?.overview;
  const analytics = analyticsQuery.data?.analytics;
  const currency = overview?.currency ?? analytics?.currency ?? 'KES';

  const trendData = useMemo(
    () => (analytics?.monthlyTrend ?? []).map((p) => ({ ...p, label: monthLabel(p.month) })),
    [analytics?.monthlyTrend],
  );

  const conversionData = useMemo(
    () =>
      (analytics?.stageConversion ?? []).map((c) => ({
        ...c,
        label: `${stageLabel(c.fromStage)} → ${stageLabel(c.toStage)}`,
        rate: c.ratePct ?? 0,
      })),
    [analytics?.stageConversion],
  );

  const status = overviewQuery.isLoading
    ? 'loading'
    : overviewQuery.isError
      ? 'error'
      : 'success';

  const empty =
    overview != null &&
    overview.teamTarget === 0 &&
    overview.closedRevenue === 0 &&
    overview.weightedPipeline === 0 &&
    overview.funnel.every((f) => f.count === 0);

  const maxActivity = Math.max(1, ...(analytics?.activityLeaderboard ?? []).map((r) => r.activities));

  return (
    <div className="space-y-0">
      <ModuleHomeContent domainId="sales" />

      <DashboardPageSection className="mt-8 border-t border-[var(--dash-border)] pt-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--dash-text-strong)]">
              Sales performance analytics
            </h2>
            <p className="mt-0.5 text-sm text-[var(--dash-text-muted)]">
              Attainment, velocity, conversion, and rep activity — live across your pipeline.
            </p>
          </div>
          <Link
            href="/dashboard/sales/attainment"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm font-medium text-[var(--dash-text-strong)] transition-colors hover:bg-[var(--dash-hover)]"
          >
            <Trophy className="h-4 w-4 text-[var(--stride-coral)]" /> Leaderboard
          </Link>
        </div>

        <DashboardAsyncState
          status={status}
          error={overviewQuery.error?.message}
          onRetry={() => void overviewQuery.refetch()}
          loading={<DashboardPageSkeleton variant="stats" />}
        >
          {empty ? (
            <div className="dashboard-surface px-6 py-12 text-center">
              <p className="text-lg font-semibold text-[var(--dash-text-strong)]">No pipeline yet</p>
              <p className="mt-2 text-sm text-[var(--dash-text-muted)]">
                Add your first deal to populate targets, coverage, and attainment.
              </p>
              <Link
                href="/dashboard/sales/deals"
                className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
              >
                <Plus className="h-4 w-4" /> Open pipeline
              </Link>
            </div>
          ) : overview ? (
            <div className="space-y-6">
              <DashboardStatGrid columns={4}>
                <DashboardMetricCard
                  label="Team target"
                  value={formatCompactCurrency(overview.teamTarget, currency)}
                  hint={`${overview.periodStart} → ${overview.periodEnd}`}
                  icon={Target}
                  tone="primary"
                />
                <DashboardMetricCard
                  label="Closed revenue"
                  value={formatCompactCurrency(overview.closedRevenue, currency)}
                  hint={`${overview.dealsClosingThisPeriod} closing this period`}
                  icon={Wallet}
                  tone="emerald"
                />
                <DashboardMetricCard
                  label="Attainment"
                  value={overview.attainmentPct != null ? `${overview.attainmentPct}%` : '—'}
                  hint="of team quota"
                  icon={Gauge}
                  tone="primary"
                  highlighted
                />
                <DashboardMetricCard
                  label="Pipeline coverage"
                  value={overview.coverage != null ? `${overview.coverage}×` : '—'}
                  hint={`${formatCompactCurrency(overview.weightedPipeline, currency)} weighted`}
                  icon={Layers}
                  tone="violet"
                />
                <DashboardMetricCard
                  label="Win rate"
                  value={formatPercent(overview.winRatePct)}
                  hint="won ÷ closed"
                  icon={Trophy}
                  tone="emerald"
                />
                <DashboardMetricCard
                  label="Avg deal size"
                  value={
                    overview.avgDealSize != null
                      ? formatCompactCurrency(overview.avgDealSize, currency)
                      : '—'
                  }
                  hint="won deals"
                  icon={Coins}
                  tone="amber"
                />
                <DashboardMetricCard
                  label="Avg sales cycle"
                  value={overview.avgSalesCycleDays != null ? `${overview.avgSalesCycleDays}d` : '—'}
                  hint="create → close"
                  icon={CalendarClock}
                  tone="sky"
                />
                <DashboardMetricCard
                  label="Sales velocity"
                  value={`${formatCompactCurrency(overview.salesVelocity, currency)}/d`}
                  hint="revenue per day"
                  icon={TrendingUp}
                  tone="violet"
                />
              </DashboardStatGrid>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <SalesChartCard
                  title="Pipeline funnel by stage"
                  icon={Filter}
                  isEmpty={overview.funnel.every((f) => f.value === 0)}
                  emptyLabel="No open pipeline yet."
                >
                  <SalesFunnelChart data={overview.funnel} currency={currency} />
                </SalesChartCard>

                <SalesChartCard
                  title="Stage conversion"
                  icon={BarChart3}
                  isEmpty={conversionData.every((c) => c.fromCount === 0)}
                  emptyLabel="Not enough movement to compute conversion."
                >
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={conversionData}
                      layout="vertical"
                      margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} stroke={SALES_CHART.gridStroke} strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={SALES_CHART.axisTick}
                        tickLine={false}
                        axisLine={{ stroke: SALES_CHART.gridStroke }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={150}
                        tick={SALES_CHART.axisTick}
                        tickLine={false}
                        axisLine={{ stroke: SALES_CHART.gridStroke }}
                      />
                      <Tooltip
                        content={<SalesChartTooltip />}
                        cursor={{ fill: 'var(--dash-hover)' }}
                      />
                      <Bar dataKey="rate" name="Conversion %" radius={[0, 6, 6, 0]} maxBarSize={26}>
                        {conversionData.map((entry) => (
                          <Cell
                            key={entry.toStage}
                            fill={STAGE_CHART_COLOR[entry.toStage as SalesDealStage] ?? SALES_CHART.coral}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </SalesChartCard>

                <SalesChartCard
                  title={`Monthly trend (${analytics?.months ?? 6} months)`}
                  icon={TrendingUp}
                  isEmpty={trendData.every((p) => p.created === 0 && p.won === 0)}
                  emptyLabel="No deal activity in this window."
                >
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={trendData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesCreated" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={SALES_CHART.swatches.sky.accent} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={SALES_CHART.swatches.sky.accent} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="salesWon" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={SALES_CHART.swatches.emerald.accent} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={SALES_CHART.swatches.emerald.accent} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={SALES_CHART.gridStroke} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tick={SALES_CHART.axisTick}
                        tickLine={false}
                        axisLine={{ stroke: SALES_CHART.gridStroke }}
                      />
                      <YAxis
                        yAxisId="count"
                        allowDecimals={false}
                        tick={SALES_CHART.axisTick}
                        tickLine={false}
                        axisLine={{ stroke: SALES_CHART.gridStroke }}
                      />
                      <YAxis
                        yAxisId="value"
                        orientation="right"
                        tick={SALES_CHART.axisTick}
                        tickLine={false}
                        axisLine={{ stroke: SALES_CHART.gridStroke }}
                        tickFormatter={(v) => formatCompactCurrency(Number(v), currency)}
                        width={70}
                      />
                      <Tooltip content={<SalesChartTooltip />} cursor={{ stroke: SALES_CHART.gridStroke }} />
                      <Area
                        yAxisId="count"
                        type="monotone"
                        dataKey="created"
                        name="Created"
                        stroke={SALES_CHART.swatches.sky.accent}
                        strokeWidth={2}
                        fill="url(#salesCreated)"
                      />
                      <Area
                        yAxisId="count"
                        type="monotone"
                        dataKey="won"
                        name="Won"
                        stroke={SALES_CHART.swatches.emerald.accent}
                        strokeWidth={2}
                        fill="url(#salesWon)"
                      />
                      <Line
                        yAxisId="value"
                        type="monotone"
                        dataKey="wonValue"
                        name="Won value"
                        stroke={SALES_CHART.coral}
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </SalesChartCard>

                <SalesChartCard
                  title="Deal aging"
                  icon={TimerReset}
                  action={
                    analytics && analytics.rotting.count > 0 ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                        {analytics.rotting.count} rotting
                      </span>
                    ) : null
                  }
                  isEmpty={(analytics?.dealAging ?? []).every((b) => b.count === 0)}
                  emptyLabel="No open deals to age."
                >
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={analytics?.dealAging ?? []}
                      margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                    >
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
                      <Bar dataKey="count" name="Open deals" radius={[6, 6, 0, 0]} maxBarSize={56}>
                        {(analytics?.dealAging ?? []).map((entry) => (
                          <Cell key={entry.bucket} fill={AGING_COLOR[entry.bucket] ?? SALES_CHART.coral} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </SalesChartCard>
              </div>

              <SalesChartCard
                title="Rep activity leaderboard"
                icon={Activity}
                isEmpty={(analytics?.activityLeaderboard ?? []).length === 0}
                emptyLabel="No logged activities yet."
                height={200}
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
                      <tr>
                        <th className="pb-2 pr-4 font-semibold">Rep</th>
                        <th className="pb-2 pr-4 font-semibold">Activities</th>
                        <th className="hidden pb-2 pr-4 font-semibold sm:table-cell">Deals won</th>
                        <th className="pb-2 text-right font-semibold">Closed value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analytics?.activityLeaderboard ?? []).map((row) => (
                        <tr key={row.employeeId} className="border-t border-[var(--dash-border)]">
                          <td className="py-2.5 pr-4 font-medium text-[var(--dash-text-strong)]">
                            {row.employeeName}
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="w-8 tabular-nums text-[var(--dash-text-strong)]">
                                {row.activities}
                              </span>
                              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[var(--dash-surface-muted)]">
                                <div
                                  className="h-full rounded-full bg-[var(--stride-coral)]"
                                  style={{ width: `${Math.round((row.activities / maxActivity) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="hidden py-2.5 pr-4 tabular-nums text-[var(--dash-text-body)] sm:table-cell">
                            {row.dealsWon}
                          </td>
                          <td className="py-2.5 text-right tabular-nums font-medium text-[var(--dash-text-strong)]">
                            {formatSalesCurrency(row.closedValue, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SalesChartCard>
            </div>
          ) : (
            <p className="py-12 text-sm text-[var(--dash-text-muted)]">Unable to load sales overview.</p>
          )}
        </DashboardAsyncState>
      </DashboardPageSection>
    </div>
  );
}
