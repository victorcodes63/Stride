import type { ReactNode } from 'react';
import { DASHBOARD_STAT_CARD_CLASS } from '@/lib/dashboard-layout';
import {
  DASHBOARD_STAT_TONE_CLASSES,
  type DashboardStatTone,
} from '@/lib/platform-swatches';

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

type Columns = 2 | 3 | 4;

export type { DashboardStatTone };

const columnClass: Record<Columns, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
};

export function DashboardStatGrid({
  children,
  columns = 4,
  className,
}: {
  children: ReactNode;
  columns?: Columns;
  className?: string;
}) {
  return <div className={cn('grid gap-3', columnClass[columns], className)}>{children}</div>;
}

export function DashboardStatCard({
  label,
  value,
  hint,
  trend,
  className,
  tone = 'primary',
  warn,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: ReactNode;
  className?: string;
  /** Coloured accent strip + subtle card wash */
  tone?: DashboardStatTone;
  warn?: boolean;
}) {
  const styles = DASHBOARD_STAT_TONE_CLASSES[tone] ?? DASHBOARD_STAT_TONE_CLASSES.primary;

  return (
    <div
      className={cn(
        DASHBOARD_STAT_CARD_CLASS,
        'relative overflow-hidden bg-gradient-to-br shadow-sm',
        styles.wash,
        className,
      )}
    >
      <div
        className={cn('absolute inset-y-0 left-0 w-1.5', styles.bar)}
        aria-hidden
      />
      <div className="relative pl-3.5">
        <p className="dash-stat-label text-[11px] font-semibold uppercase tracking-wider text-[var(--dash-text-muted)]">
          {label}
        </p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <p
            className={cn(
              'dash-stat-value text-2xl font-semibold tabular-nums text-[var(--dash-text-strong)]',
              warn && 'text-[var(--dash-text-strong)]',
            )}
          >
            {value}
          </p>
          {trend ? <div className="text-xs text-[var(--dash-text-muted)]">{trend}</div> : null}
        </div>
        {hint ? <p className="dash-stat-hint mt-1 text-xs text-[var(--dash-text-subtle)]">{hint}</p> : null}
      </div>
    </div>
  );
}
