import type { ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import { DASHBOARD_STAT_CARD_CLASS } from '@/lib/dashboard-layout';
import type { DashboardKpiVariant, DashboardStatTone } from '@/lib/platform-swatches';

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
  return <div className={cn('grid gap-3 sm:gap-4', columnClass[columns], className)}>{children}</div>;
}

/**
 * Platform-standard stats badge (Overview home hero).
 * Label + optional icon, large tabular value, caption — used across module homes and workspaces.
 */
export function DashboardStatBadge({
  label,
  value,
  hint,
  icon: Icon,
  href,
  attention = false,
  size = 'default',
  className,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  href?: string;
  /** Coral icon well when the metric needs action. */
  attention?: boolean;
  size?: 'default' | 'compact';
  className?: string;
  onClick?: () => void;
}) {
  const interactive = Boolean(href || onClick);
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-[var(--dash-text-muted)]">{label}</span>
        {Icon ? (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              attention
                ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300'
                : 'bg-[var(--dash-surface-muted)] text-[var(--dash-text-muted)]',
            )}
            aria-hidden
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          'font-semibold leading-none tracking-[-0.03em] text-[var(--dash-text-strong)] tabular-nums',
          size === 'compact'
            ? 'mt-4 text-[22px] sm:text-[26px]'
            : 'mt-6 text-[28px] sm:text-[34px]',
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-2 flex items-center gap-1 text-[13px] text-[var(--dash-text-subtle)]">
          {hint}
          {interactive ? (
            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
          ) : null}
        </p>
      ) : null}
    </>
  );

  const shellClass = cn(
    DASHBOARD_STAT_CARD_CLASS,
    'group relative flex flex-col justify-between !p-5 sm:!p-6 transition-all duration-200',
    interactive && 'hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-18px_rgba(26,23,20,0.35)]',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={shellClass}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(shellClass, 'w-full text-left')}>
        {body}
      </button>
    );
  }

  return <div className={shellClass}>{body}</div>;
}

/** @deprecated Prefer DashboardStatBadge — kept as an alias for existing call sites. */
export function DashboardMetricCard({
  label,
  value,
  hint,
  icon,
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
  return (
    <DashboardStatBadge
      label={label}
      value={value}
      hint={hint}
      icon={icon}
      attention={highlighted}
      className={className}
    />
  );
}

/** @deprecated Prefer DashboardStatBadge — kept as an alias for existing call sites. */
export function DashboardStatCard({
  label,
  value,
  hint,
  trend,
  className,
  tone: _tone = 'primary',
  warn,
  size = 'default',
  icon,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: ReactNode;
  className?: string;
  tone?: DashboardStatTone;
  warn?: boolean;
  size?: 'default' | 'compact';
  icon?: LucideIcon;
  href?: string;
}) {
  return (
    <DashboardStatBadge
      label={label}
      value={value}
      hint={hint ?? (typeof trend === 'string' ? trend : undefined)}
      icon={icon}
      href={href}
      attention={Boolean(warn)}
      size={size}
      className={className}
    />
  );
}
