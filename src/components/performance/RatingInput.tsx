'use client';

import { ratingLabel } from '@/lib/performance/rating-label';
import { scoreAccent } from './score-tone';

const SCALE = [1, 2, 3, 4, 5] as const;

/**
 * Accessible 1–5 rating control rendered as a segmented button group (radiogroup).
 * Replaces the inconsistent native range sliders / dropdowns used across the
 * performance review and ESS screens.
 */
export function RatingInput({
  value,
  onChange,
  disabled = false,
  ariaLabel,
  showLabel = true,
  size = 'md',
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}) {
  const cell = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';

  function handleKey(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(5, (value || 0) + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(1, (value || 1) - 1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label={ariaLabel ?? 'Rating from 1 to 5'}
        className="inline-flex overflow-hidden rounded-lg border border-[var(--dash-input-border)] bg-[var(--dash-input-bg)]"
        onKeyDown={handleKey}
      >
        {SCALE.map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${n} — ${ratingLabel(n)}`}
              tabIndex={active || (!value && n === 1) ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(n)}
              className={`${cell} flex items-center justify-center border-r border-[var(--dash-input-border)] font-semibold tabular-nums transition-colors last:border-r-0 disabled:cursor-not-allowed disabled:opacity-60`}
              style={
                active
                  ? { backgroundColor: scoreAccent(n), color: 'white' }
                  : { color: 'var(--dash-text-body)' }
              }
            >
              {n}
            </button>
          );
        })}
      </div>
      {showLabel ? (
        <span className="text-xs font-medium text-[var(--dash-text-muted)]">{ratingLabel(value)}</span>
      ) : null}
    </div>
  );
}
