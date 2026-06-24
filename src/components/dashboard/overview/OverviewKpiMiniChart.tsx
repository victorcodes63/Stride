import type { OverviewKpiChartSegment } from '@/lib/dashboard-overview-personalization';

const TONE_BAR_CLASS: Record<OverviewKpiChartSegment['tone'], string> = {
  primary: 'bg-primary-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
  muted: 'bg-[var(--dash-border)]',
};

type Props = {
  segments: OverviewKpiChartSegment[];
  /** Decorative trend when there is no live data yet (e.g. roadmap modules). */
  placeholder?: boolean;
  className?: string;
};

function segmentHeight(value: number, max: number, placeholder: boolean, index: number, total: number): number {
  if (placeholder) {
    const wave = [28, 42, 36, 48, 32];
    return wave[index % wave.length] ?? 32;
  }
  if (max <= 0) return 10;
  if (value <= 0) return 8;
  return Math.max((value / max) * 100, 14);
}

/** Compact vertical bar chart for overview KPI cells. */
export function OverviewKpiMiniChart({ segments, placeholder = false, className = '' }: Props) {
  if (segments.length === 0) return null;

  const max = Math.max(...segments.map((s) => s.value), 0);
  const ariaLabel = segments.map((s) => `${s.label} ${s.value}`).join(', ');

  return (
    <div
      className={`mt-3 flex h-14 items-end gap-1.5 ${className}`}
      role="img"
      aria-label={placeholder ? 'Preview trend' : ariaLabel}
    >
      {segments.map((segment, index) => {
        const height = segmentHeight(segment.value, max, placeholder, index, segments.length);
        return (
          <div key={segment.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-10 w-full items-end justify-center">
              <div
                className={`w-full max-w-8 rounded-t-sm transition-all ${TONE_BAR_CLASS[segment.tone]}`}
                style={{ height: `${height}%`, minHeight: '3px' }}
              />
            </div>
            <span className="w-full truncate text-center text-[9px] leading-none text-[var(--dash-text-subtle)]">
              {segment.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
