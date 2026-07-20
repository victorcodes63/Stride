'use client';

import type { CSSProperties } from 'react';

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export type ChartTone = 'primary' | 'primarySoft' | 'neutral' | 'danger';

const TONE_FILL: Record<ChartTone, string> = {
  primary: 'var(--swatch-coral-accent)',
  primarySoft: 'color-mix(in srgb, var(--swatch-coral-accent) 45%, var(--dash-surface-solid))',
  neutral: 'color-mix(in srgb, var(--dash-text-muted) 55%, var(--dash-surface-solid))',
  danger: 'var(--swatch-rose-accent)',
};

export type HBarDatum = {
  label: string;
  value: number;
  tone?: ChartTone;
  hint?: string;
};

/** Horizontal labelled bars — used for task-status distribution and overdue-by-owner. */
export function HorizontalBarChart({
  data,
  emptyLabel = 'No data',
  formatValue,
}: {
  data: HBarDatum[];
  emptyLabel?: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const hasValues = data.some((d) => d.value > 0);

  if (data.length === 0 || !hasValues) {
    return <p className="py-6 text-center text-sm text-[var(--dash-text-muted)]">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {data.map((d) => {
        const pct = Math.round((d.value / max) * 100);
        return (
          <li key={d.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-[var(--dash-text-body)]">
                  {d.label}
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--dash-text-strong)]">
                  {formatValue ? formatValue(d.value) : d.value}
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--dash-surface-muted)' }}
                role="img"
                aria-label={`${d.label}: ${d.value}`}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${pct}%`, backgroundColor: TONE_FILL[d.tone ?? 'primary'] }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export type ThroughputPoint = {
  label: string;
  started: number;
  completed: number;
};

/** Grouped vertical mini bar chart — started vs completed workflows per month. */
export function ThroughputChart({ data }: { data: ThroughputPoint[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.started, d.completed]));
  const hasValues = data.some((d) => d.started > 0 || d.completed > 0);

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[11px] text-[var(--dash-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: TONE_FILL.primary }}
            aria-hidden
          />
          Started
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: TONE_FILL.primarySoft }}
            aria-hidden
          />
          Completed
        </span>
      </div>

      {!hasValues ? (
        <p className="py-6 text-center text-sm text-[var(--dash-text-muted)]">
          No workflow activity in the last 6 months
        </p>
      ) : (
        <div className="flex h-40 items-end justify-between gap-2">
          {data.map((d) => (
            <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <Bar value={d.started} max={max} tone="primary" title={`${d.label}: ${d.started} started`} />
                <Bar
                  value={d.completed}
                  max={max}
                  tone="primarySoft"
                  title={`${d.label}: ${d.completed} completed`}
                />
              </div>
              <span className="text-[11px] font-medium text-[var(--dash-text-muted)]">{d.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Bar({
  value,
  max,
  tone,
  title,
}: {
  value: number;
  max: number;
  tone: ChartTone;
  title: string;
}) {
  const heightPct = value > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  const style: CSSProperties = {
    height: `${heightPct}%`,
    backgroundColor: TONE_FILL[tone],
  };
  return (
    <div className="flex h-full w-3.5 items-end sm:w-5" title={title}>
      <div
        className={cn('w-full rounded-t-sm transition-[height] duration-500', value === 0 && 'opacity-0')}
        style={style}
        role="img"
        aria-label={title}
      />
    </div>
  );
}

export type DonutSegment = {
  label: string;
  value: number;
  tone: ChartTone;
};

/** Compact donut for task-status share. Pure SVG, dependency-free. */
export function StatusDonut({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offsetAcc = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[120px] w-[120px] shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="var(--dash-surface-muted)"
            strokeWidth="14"
          />
          {total > 0 &&
            segments.map((s) => {
              if (s.value <= 0) return null;
              const fraction = s.value / total;
              const dash = fraction * circumference;
              const seg = (
                <circle
                  key={s.label}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={TONE_FILL[s.tone]}
                  strokeWidth="14"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offsetAcc}
                />
              );
              offsetAcc += dash;
              return seg;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums text-[var(--dash-text-strong)]">{total}</span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--dash-text-muted)]">Tasks</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: TONE_FILL[s.tone] }}
                aria-hidden
              />
              <span className="truncate text-[var(--dash-text-body)]">{s.label}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-[var(--dash-text-strong)]">
              {s.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
