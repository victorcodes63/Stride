'use client';

import { type ComponentType, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { STRIDE_DASHBOARD_SWATCHES } from '@/lib/platform-swatches';
import type { SalesDealStage } from '@/lib/sales/schema';
import { stageLabel } from '@/lib/sales/schema';
import { formatCompactCurrency } from '@/lib/sales/format';

export const SALES_CHART = {
  axisTick: { fill: 'var(--dash-text-muted)', fontSize: 12 } as const,
  gridStroke: 'var(--dash-border)',
  coral: STRIDE_DASHBOARD_SWATCHES.coral.accent,
  swatches: STRIDE_DASHBOARD_SWATCHES,
};

/** Per-stage chart colors (aligned with SalesStageBadge tones). */
export const STAGE_CHART_COLOR: Record<SalesDealStage, string> = {
  lead: '#94A3B8',
  qualified: STRIDE_DASHBOARD_SWATCHES.sky.accent,
  proposal: STRIDE_DASHBOARD_SWATCHES.violet.accent,
  negotiation: STRIDE_DASHBOARD_SWATCHES.amber.accent,
  won: STRIDE_DASHBOARD_SWATCHES.emerald.accent,
  lost: STRIDE_DASHBOARD_SWATCHES.rose.accent,
};

export function SalesChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }>;
  label?: string | number;
  currency?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const heading = label ?? (payload[0]?.payload?.label as string | undefined) ?? payload[0]?.name;
  return (
    <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3 py-2 text-xs shadow-lg">
      {heading ? <p className="mb-1 font-semibold text-[var(--dash-text-strong)]">{heading}</p> : null}
      {payload.map((entry, index) => (
        <p key={index} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color ?? SALES_CHART.coral }}
          />
          <span className="tabular-nums font-medium text-[var(--dash-text-strong)]">
            {currency && typeof entry.value === 'number'
              ? formatCompactCurrency(entry.value, currency)
              : entry.value}
          </span>
          <span className="text-[var(--dash-text-muted)]">{entry.name}</span>
        </p>
      ))}
    </div>
  );
}

export function SalesChartCard({
  title,
  icon: Icon,
  action,
  isEmpty,
  emptyLabel = 'No data yet.',
  height = 280,
  children,
}: {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  isEmpty?: boolean;
  emptyLabel?: string;
  height?: number;
  children: ReactNode;
}) {
  return (
    <section className="dashboard-surface min-w-0 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
          {Icon ? <Icon className="h-4 w-4 text-[var(--stride-coral)]" /> : null}
          {title}
        </h3>
        {action}
      </div>
      {isEmpty ? (
        <div className="flex items-center justify-center" style={{ height }}>
          <p className="text-sm text-[var(--dash-text-muted)]">{emptyLabel}</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** Horizontal funnel bars colored per stage. */
export function SalesFunnelChart({
  data,
  currency = 'KES',
  height,
}: {
  data: Array<{ stage: string; count: number; value: number }>;
  currency?: string;
  height?: number;
}) {
  const rows = data.map((d) => ({ ...d, label: stageLabel(d.stage) }));
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(220, rows.length * 46)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <XAxis
          type="number"
          tick={SALES_CHART.axisTick}
          tickLine={false}
          axisLine={{ stroke: SALES_CHART.gridStroke }}
          tickFormatter={(v) => formatCompactCurrency(Number(v), currency)}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={92}
          tick={SALES_CHART.axisTick}
          tickLine={false}
          axisLine={{ stroke: SALES_CHART.gridStroke }}
        />
        <Tooltip content={<SalesChartTooltip currency={currency} />} cursor={{ fill: 'var(--dash-hover)' }} />
        <Bar dataKey="value" name="Value" radius={[0, 6, 6, 0]} maxBarSize={30}>
          {rows.map((entry) => (
            <Cell key={entry.stage} fill={STAGE_CHART_COLOR[entry.stage as SalesDealStage] ?? SALES_CHART.coral} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
