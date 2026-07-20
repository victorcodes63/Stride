'use client';

import { ratingLabel } from '@/lib/performance/rating-label';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { scoreAccent, scoreTone } from './score-tone';

/** Horizontal score bar (x/5) with optional numeric readout — for table cells and cards. */
export function ScoreBar({
  score,
  max = 5,
  showValue = true,
  showLabel = false,
  className,
}: {
  score: number | null | undefined;
  max?: number;
  showValue?: boolean;
  showLabel?: boolean;
  className?: string;
}) {
  if (score == null) {
    return <span className="text-sm text-[var(--dash-text-muted)]">—</span>;
  }
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      <div className="flex items-center gap-2">
        <div
          className="h-2 w-full max-w-[120px] overflow-hidden rounded-full"
          style={{ backgroundColor: 'var(--dash-surface-muted)' }}
          role="img"
          aria-label={`${score.toFixed(1)} of ${max}`}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, backgroundColor: scoreAccent(score) }}
          />
        </div>
        {showValue ? (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--dash-text-strong)]">
            {Number(score).toFixed(score % 1 === 0 ? 0 : 1)}/{max}
          </span>
        ) : null}
      </div>
      {showLabel ? (
        <span className="mt-0.5 block text-[11px] text-[var(--dash-text-muted)]">{ratingLabel(score)}</span>
      ) : null}
    </div>
  );
}

/** Compact score pill with rating label — tone follows the score. */
export function ScoreBadge({
  score,
  max = 5,
  withLabel = true,
}: {
  score: number | null | undefined;
  max?: number;
  withLabel?: boolean;
}) {
  if (score == null) {
    return <span className={dashStatusChip('neutral')}>Not rated</span>;
  }
  return (
    <span className={dashStatusChip(scoreTone(score))}>
      {Number(score).toFixed(score % 1 === 0 ? 0 : 1)}/{max}
      {withLabel ? ` · ${ratingLabel(score)}` : ''}
    </span>
  );
}
