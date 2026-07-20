'use client';

export type ProgressRingTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_STROKE: Record<ProgressRingTone, string> = {
  primary: 'var(--swatch-coral-accent)',
  success: 'var(--swatch-emerald-accent)',
  warning: 'var(--swatch-amber-accent)',
  danger: 'var(--swatch-rose-accent)',
  info: 'var(--swatch-sky-accent)',
  neutral: 'var(--dash-text-subtle)',
};

/**
 * Accessible SVG donut showing completion of a workflow.
 * Renders the percentage in the centre for larger sizes; the surrounding
 * markup should still provide a text `complete/total` label for screen density.
 */
export function WorkflowProgressRing({
  value,
  total,
  size = 44,
  tone = 'primary',
  showValue,
  className,
}: {
  /** Number of completed items. */
  value: number;
  /** Total number of items. */
  total: number;
  /** Pixel diameter of the ring. */
  size?: number;
  tone?: ProgressRingTone;
  /** Force the centre percentage on/off. Defaults to visible when size >= 44. */
  showValue?: boolean;
  className?: string;
}) {
  const safeTotal = Math.max(total, 0);
  const pct = safeTotal > 0 ? Math.round((Math.min(value, safeTotal) / safeTotal) * 100) : 0;
  const stroke = size >= 72 ? 7 : size >= 52 ? 6 : size >= 40 ? 5 : 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;
  const withValue = showValue ?? size >= 44;
  const center = size / 2;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${value} of ${safeTotal} complete, ${pct}%`}
        className="-rotate-90"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--dash-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={TONE_STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      {withValue ? (
        <span
          className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-[var(--dash-text-strong)]"
          style={{ fontSize: Math.max(9, Math.round(size * 0.28)) }}
          aria-hidden
        >
          {pct}
          <span className="ml-px" style={{ fontSize: Math.max(7, Math.round(size * 0.18)) }}>
            %
          </span>
        </span>
      ) : null}
    </div>
  );
}
