'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Camera,
  Coins,
  Gauge,
  Layers,
  Loader2,
  PieChart,
  Target as TargetIcon,
  TrendingUp,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatGrid, DashboardMetricCard } from '@/components/dashboard/DashboardStatGrid';
import {
  SalesChartCard,
  SalesChartTooltip,
  SalesEmptyState,
  SALES_CHART,
} from '@/components/dashboard/sales';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';
import {
  formatCompactCurrency,
  formatSalesCurrency,
  formatShortDate,
} from '@/lib/sales/format';
import {
  salesKeys,
  useSalesMutation,
  useSalesResource,
  apiFetch,
} from '@/lib/sales/hooks';
import { toast } from '@/components/ui/toast';

type PeriodType = 'month' | 'quarter' | 'year';
type Scenario = 'commit' | 'best' | 'pipeline';

type ForecastDeal = {
  id: string;
  name: string;
  stage: string;
  value: number;
  probability: number;
  forecastCategory: string;
  expectedCloseDate: string | null;
};

type Snapshot = {
  id: string;
  takenAt: string;
  commitAmount: number;
  bestCaseAmount: number;
  pipelineAmount: number;
  closedAmount: number;
  teamTarget: number;
  notes: string | null;
};

type ForecastData = {
  rollup: {
    commitAmount: number;
    bestCaseAmount: number;
    pipelineAmount: number;
    closedAmount: number;
  };
  teamTarget: number;
  currency: string;
  deals: ForecastDeal[];
  snapshots: Snapshot[];
  periodStart: string;
  periodEnd: string;
};

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

const SCENARIO_OPTIONS: { value: Scenario; label: string }[] = [
  { value: 'commit', label: 'Commit only' },
  { value: 'best', label: 'Commit + Best' },
  { value: 'pipeline', label: '+ Pipeline' },
];

const CATEGORY_LABELS: Record<string, string> = {
  commit: 'Commit',
  best_case: 'Best case',
  pipeline: 'Pipeline',
  omitted: 'Omitted',
};

const STEP_COLORS = {
  closed: SALES_CHART.swatches.emerald.accent,
  commit: SALES_CHART.coral,
  best: SALES_CHART.swatches.amber.accent,
  pipeline: SALES_CHART.swatches.sky.accent,
  projected: SALES_CHART.swatches.violet.accent,
};

type WaterfallDatum = {
  key: string;
  label: string;
  base: number;
  value: number;
  total: number;
  color: string;
  isTotal: boolean;
};

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-0.5"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-[var(--stride-coral)] text-white shadow-sm'
                : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text-strong)]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function WaterfallTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ payload?: WaterfallDatum }>;
  currency: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;
  return (
    <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-[var(--dash-text-strong)]">{datum.label}</p>
      <p className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: datum.color }} />
        <span className="tabular-nums font-medium text-[var(--dash-text-strong)]">
          {formatCompactCurrency(datum.value, currency)}
        </span>
        <span className="text-[var(--dash-text-muted)]">{datum.isTotal ? 'projected' : 'step'}</span>
      </p>
      {!datum.isTotal ? (
        <p className="mt-0.5 text-[var(--dash-text-muted)]">
          Running total: {formatCompactCurrency(datum.total, currency)}
        </p>
      ) : null}
    </div>
  );
}

export default function SalesForecastContent() {
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [scenario, setScenario] = useState<Scenario>('best');

  const query = useSalesResource<ForecastData>(
    salesKeys.forecast({ periodType }),
    `/api/sales/forecast?periodType=${periodType}`,
  );
  const data = query.data;

  const snapshotMutation = useSalesMutation<unknown, void>(
    () =>
      apiFetch('/api/sales/forecast', {
        method: 'POST',
        body: JSON.stringify({
          action: 'snapshot',
          periodType,
          ...(data ? { periodStart: data.periodStart, periodEnd: data.periodEnd } : {}),
        }),
      }),
    {
      invalidateKeys: [salesKeys.all],
      onSuccess: () => toast.success('Forecast snapshot saved.'),
    },
  );

  const scenarios = useMemo(() => {
    if (!data) return null;
    const { closedAmount, commitAmount, bestCaseAmount, pipelineAmount } = data.rollup;
    return {
      commit: closedAmount + commitAmount,
      best: closedAmount + commitAmount + bestCaseAmount,
      pipeline: closedAmount + commitAmount + bestCaseAmount + pipelineAmount,
    } as Record<Scenario, number>;
  }, [data]);

  const projected = scenarios ? scenarios[scenario] : 0;
  const gap = data ? projected - data.teamTarget : 0;
  const projectedPct =
    data && data.teamTarget > 0 ? Math.round((projected / data.teamTarget) * 1000) / 10 : null;

  const waterfall = useMemo<WaterfallDatum[]>(() => {
    if (!data) return [];
    const { closedAmount, commitAmount, bestCaseAmount, pipelineAmount } = data.rollup;
    const steps: WaterfallDatum[] = [];
    let running = 0;
    steps.push({ key: 'closed', label: 'Closed', base: 0, value: closedAmount, total: closedAmount, color: STEP_COLORS.closed, isTotal: false });
    running = closedAmount;
    steps.push({ key: 'commit', label: '+ Commit', base: running, value: commitAmount, total: running + commitAmount, color: STEP_COLORS.commit, isTotal: false });
    running += commitAmount;
    steps.push({ key: 'best', label: '+ Best case', base: running, value: bestCaseAmount, total: running + bestCaseAmount, color: STEP_COLORS.best, isTotal: false });
    running += bestCaseAmount;
    steps.push({ key: 'pipeline', label: '+ Pipeline', base: running, value: pipelineAmount, total: running + pipelineAmount, color: STEP_COLORS.pipeline, isTotal: false });
    running += pipelineAmount;
    steps.push({ key: 'projected', label: 'Projected', base: 0, value: running, total: running, color: STEP_COLORS.projected, isTotal: true });
    return steps;
  }, [data]);

  const history = useMemo(() => {
    if (!data) return [];
    return [...data.snapshots]
      .slice()
      .reverse()
      .map((s) => ({
        label: formatShortDate(s.takenAt),
        Closed: s.closedAmount,
        Commit: s.commitAmount,
        Projected: s.closedAmount + s.commitAmount + s.bestCaseAmount + s.pipelineAmount,
        Target: s.teamTarget,
      }));
  }, [data]);

  const deltas = useMemo(() => {
    if (!data) return null;
    const [latest, previous] = data.snapshots;
    if (!latest || !previous) return null;
    return [
      { label: 'Commit', delta: latest.commitAmount - previous.commitAmount },
      { label: 'Best case', delta: latest.bestCaseAmount - previous.bestCaseAmount },
      { label: 'Pipeline', delta: latest.pipelineAmount - previous.pipelineAmount },
      { label: 'Closed', delta: latest.closedAmount - previous.closedAmount },
    ];
  }, [data]);

  const currency = data?.currency ?? 'KES';

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Forecast"
        description="Commit, best case, and pipeline rollup projected against the team quota."
        icon={PieChart}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              value={periodType}
              options={PERIOD_OPTIONS}
              onChange={setPeriodType}
              ariaLabel="Forecast period"
            />
            <button
              type="button"
              disabled={snapshotMutation.isPending || !data}
              onClick={() => snapshotMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {snapshotMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              Save snapshot
            </button>
          </div>
        }
      />

      {query.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {query.error?.message ?? 'Failed to load forecast.'}
        </div>
      ) : null}

      {query.isLoading ? (
        <ForecastSkeleton />
      ) : !data ? (
        <SalesEmptyState
          icon={PieChart}
          title="No forecast data"
          description="Add deals with expected close dates in this period to populate the rollup."
        />
      ) : (
        <>
          <p className="text-xs text-[var(--dash-text-muted)]">
            {formatShortDate(data.periodStart)} → {formatShortDate(data.periodEnd)}
          </p>

          <DashboardStatGrid columns={6}>
            <DashboardMetricCard
              label="Commit"
              value={formatCompactCurrency(data.rollup.commitAmount, currency)}
              icon={TargetIcon}
              tone="primary"
            />
            <DashboardMetricCard
              label="Best case"
              value={formatCompactCurrency(data.rollup.bestCaseAmount, currency)}
              icon={TrendingUp}
              tone="amber"
            />
            <DashboardMetricCard
              label="Pipeline"
              value={formatCompactCurrency(data.rollup.pipelineAmount, currency)}
              icon={Layers}
              tone="sky"
            />
            <DashboardMetricCard
              label="Closed"
              value={formatCompactCurrency(data.rollup.closedAmount, currency)}
              icon={Coins}
              tone="emerald"
            />
            <DashboardMetricCard
              label="Team target"
              value={formatCompactCurrency(data.teamTarget, currency)}
              icon={Gauge}
              tone="violet"
            />
            <DashboardMetricCard
              label={gap >= 0 ? 'Ahead of target' : 'Gap to target'}
              value={formatCompactCurrency(Math.abs(gap), currency)}
              hint={
                projectedPct != null
                  ? `${projectedPct}% of quota · ${SCENARIO_OPTIONS.find((s) => s.value === scenario)?.label}`
                  : SCENARIO_OPTIONS.find((s) => s.value === scenario)?.label
              }
              icon={Gauge}
              tone={gap >= 0 ? 'emerald' : 'amber'}
            />
          </DashboardStatGrid>

          <SalesChartCard
            title="Forecast waterfall"
            icon={Layers}
            height={320}
            action={
              <SegmentedControl
                value={scenario}
                options={SCENARIO_OPTIONS}
                onChange={setScenario}
                ariaLabel="Forecast scenario"
              />
            }
          >
            <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <span className="text-[var(--dash-text-muted)]">Projected total</span>
              <span className="text-lg font-semibold tabular-nums text-[var(--dash-text-strong)]">
                {formatSalesCurrency(projected, currency)}
              </span>
              <span
                className={`text-xs font-medium ${
                  gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {gap >= 0 ? 'Ahead by ' : 'Short by '}
                {formatCompactCurrency(Math.abs(gap), currency)}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={waterfall} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={SALES_CHART.axisTick}
                  tickLine={false}
                  axisLine={{ stroke: SALES_CHART.gridStroke }}
                  interval={0}
                />
                <YAxis
                  tick={SALES_CHART.axisTick}
                  tickLine={false}
                  axisLine={{ stroke: SALES_CHART.gridStroke }}
                  tickFormatter={(v) => formatCompactCurrency(Number(v), currency)}
                  width={64}
                />
                <Tooltip
                  content={<WaterfallTooltip currency={currency} />}
                  cursor={{ fill: 'var(--dash-hover)' }}
                />
                {data.teamTarget > 0 ? (
                  <ReferenceLine
                    y={data.teamTarget}
                    stroke={SALES_CHART.coral}
                    strokeDasharray="5 4"
                    label={{
                      value: `Target ${formatCompactCurrency(data.teamTarget, currency)}`,
                      position: 'insideTopRight',
                      fill: SALES_CHART.coral,
                      fontSize: 11,
                    }}
                  />
                ) : null}
                <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="value" stackId="waterfall" radius={[4, 4, 0, 0]} maxBarSize={72}>
                  {waterfall.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SalesChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SalesChartCard
              title="Snapshot history"
              icon={TrendingUp}
              isEmpty={history.length === 0}
              emptyLabel="No snapshots yet. Save one to track forecast changes over time."
              height={280}
            >
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={history} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="forecastProjected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={STEP_COLORS.projected} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={STEP_COLORS.projected} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="forecastClosed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={STEP_COLORS.closed} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={STEP_COLORS.closed} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={SALES_CHART.axisTick}
                    tickLine={false}
                    axisLine={{ stroke: SALES_CHART.gridStroke }}
                  />
                  <YAxis
                    tick={SALES_CHART.axisTick}
                    tickLine={false}
                    axisLine={{ stroke: SALES_CHART.gridStroke }}
                    tickFormatter={(v) => formatCompactCurrency(Number(v), currency)}
                    width={64}
                  />
                  <Tooltip content={<SalesChartTooltip currency={currency} />} cursor={{ stroke: SALES_CHART.gridStroke }} />
                  <Area
                    type="monotone"
                    dataKey="Projected"
                    stroke={STEP_COLORS.projected}
                    strokeWidth={2}
                    fill="url(#forecastProjected)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Closed"
                    stroke={STEP_COLORS.closed}
                    strokeWidth={2}
                    fill="url(#forecastClosed)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </SalesChartCard>

            <div className={`${DASHBOARD_SURFACE_CLASS} p-4 shadow-sm sm:p-5`}>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
                <TrendingUp className="h-4 w-4 text-[var(--stride-coral)]" />
                Delta vs prior snapshot
              </h3>
              {deltas ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {deltas.map((d) => (
                    <div
                      key={d.label}
                      className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-3 py-2.5"
                    >
                      <p className="text-xs text-[var(--dash-text-muted)]">{d.label}</p>
                      <p
                        className={`mt-0.5 text-base font-semibold tabular-nums ${
                          d.delta > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : d.delta < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-[var(--dash-text-strong)]'
                        }`}
                      >
                        {d.delta > 0 ? '+' : ''}
                        {formatCompactCurrency(d.delta, currency)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--dash-text-muted)]">
                  Save at least two snapshots to compare against the previous forecast.
                </p>
              )}
            </div>
          </div>

          <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
            <div className="border-b border-[var(--dash-border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Deals by category</h2>
            </div>
            {data.deals.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--dash-text-muted)]">
                No deals in this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
                    <tr>
                      <th className="px-4 py-3">Deal</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3 text-right">Prob.</th>
                      <th className="px-4 py-3">Close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deals.map((d) => (
                      <tr key={d.id} className="border-t border-[var(--dash-border)]">
                        <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">{d.name}</td>
                        <td className="px-4 py-3">
                          {CATEGORY_LABELS[d.forecastCategory] ?? d.forecastCategory}
                        </td>
                        <td className="px-4 py-3 capitalize">{d.stage}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatSalesCurrency(d.value, currency)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{d.probability}%</td>
                        <td className="px-4 py-3">{formatShortDate(d.expectedCloseDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </DashboardPage>
  );
}

function ForecastSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${DASHBOARD_SURFACE_CLASS} h-24 animate-pulse`} />
        ))}
      </div>
      <div className={`${DASHBOARD_SURFACE_CLASS} h-80 animate-pulse`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${DASHBOARD_SURFACE_CLASS} h-72 animate-pulse`} />
        <div className={`${DASHBOARD_SURFACE_CLASS} h-72 animate-pulse`} />
      </div>
    </div>
  );
}
