'use client';

import type { LucideIcon } from 'lucide-react';
import type { DashStatusTone } from '@/lib/dashboard-status-chips';
import { toneAccent } from './score-tone';

/** KPI stat tile with a swatch-toned accent rail and optional icon / secondary line. */
export function StatTile({
  label,
  value,
  tone = 'neutral',
  icon: Icon,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  tone?: DashStatusTone;
  icon?: LucideIcon;
  hint?: React.ReactNode;
}) {
  const accent = toneAccent(tone);
  return (
    <div className="dashboard-stat-card relative overflow-hidden">
      <span
        className="absolute inset-y-0 left-0 w-1 rounded-l"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2 pl-1.5">
        <div className="min-w-0">
          <div className="dash-stat-label text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--dash-text-strong)]">
            {value}
          </div>
          {hint ? <div className="mt-0.5 text-[11px] text-[var(--dash-text-muted)]">{hint}</div> : null}
        </div>
        {Icon ? (
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
            style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}
          >
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
        ) : null}
      </div>
    </div>
  );
}
