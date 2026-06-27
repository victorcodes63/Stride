import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { DASHBOARD_STAT_CARD_CLASS } from '@/lib/dashboard-layout';
import {
  DASHBOARD_KPI_CLASSES,
  DASHBOARD_STAT_TONE_CLASSES,
  type DashboardKpiVariant,
  type DashboardStatTone,
} from '@/lib/platform-swatches';

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

type Columns = 2 | 3 | 4 | 6;

export type { DashboardStatTone, DashboardKpiVariant };

const columnClass: Record<Columns, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
  6: 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6',
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

const KPI_TONE_ALIASES: Record<string, DashboardKpiVariant> = {
  info: 'violet',
  success: 'emerald',
  warning: 'amber',
  rose: 'amber',
};

function resolveKpiTone(tone: DashboardKpiVariant | string): DashboardKpiVariant {
  if (tone in DASHBOARD_KPI_CLASSES) return tone as DashboardKpiVariant;
  return KPI_TONE_ALIASES[tone] ?? 'primary';
}

/** KPI card with icon — unified styling for recruitment, people, and module headers. */
export function DashboardMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
  highlighted = false,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: DashboardKpiVariant | string;
  highlighted?: boolean;
  className?: string;
}) {
  const styles = DASHBOARD_KPI_CLASSES[resolveKpiTone(tone)];

  return (
    <div
      className={cn(
        DASHBOARD_STAT_CARD_CLASS,
        'relative min-w-0 overflow-hidden shadow-sm transition-shadow hover:shadow-md',
        styles.card,
        highlighted && 'ring-1 ring-[var(--swatch-coral-accent)]/35',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="dash-stat-label text-[10px] font-bold uppercase tracking-widest text-[var(--dash-text-muted)] sm:text-[11px]">
            {label}
          </p>
          <p className={cn('mt-1 text-2xl font-bold tabular-nums sm:text-3xl', styles.value)}>{value}</p>
          {hint ? (
            <p className="dash-stat-hint mt-1 text-[11px] leading-snug text-[var(--dash-text-subtle)]">{hint}</p>
          ) : null}
        </div>
        <div
          className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', styles.icon)}
          aria-hidden
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
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
