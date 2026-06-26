'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { DASHBOARD_PAGE_HEADER_CLASS } from '@/lib/dashboard-layout';
import { resolveDashboardPageIcon } from '@/lib/dashboard-page-icons';
import { isMainDashboardPage } from '@/lib/dashboard-route-kind';

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export type DashboardPageHeaderVariant = 'panel' | 'hero';

/** @deprecated Use `panel` — kept for backward compatibility in call sites. */
export type DashboardPageHeaderLegacyVariant = DashboardPageHeaderVariant | 'default';

export type DashboardPageHeaderBadge = {
  label: ReactNode;
  icon?: LucideIcon;
  /** Shown before the label (e.g. entity flag emoji). */
  prefix?: ReactNode;
  /** Skip the default pill wrapper (e.g. custom badge component). */
  bare?: boolean;
};

export type DashboardPageHeaderAction = {
  label: string;
  href: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary';
};

export type DashboardPageHeaderProps = {
  /** Page title or greeting (always rendered as h1). */
  title: ReactNode;
  /** Optional Lucide icon beside the title — auto-resolved on main list pages only. */
  icon?: LucideIcon | false;
  iconClassName?: string;
  /** Supporting copy — one short sentence; omit if the title is self-explanatory. */
  description?: ReactNode;
  /** Small uppercase label above the title (module area, e.g. "Finance & payroll"). */
  eyebrow?: string;
  /** Secondary line under description (date, counts, breadcrumbs text). */
  meta?: ReactNode;
  /** Context pills (role, entity, readiness) — styled for hero or panel. */
  badges?: DashboardPageHeaderBadge[];
  /** Custom action nodes, or declarative action links. */
  actions?: ReactNode | DashboardPageHeaderAction[];
  /** Optional strip below the title row (tabs, filters) — panel variant only. */
  footer?: ReactNode;
  /** Override pathname used to resolve the default icon (defaults to current route). */
  href?: string;
  variant?: DashboardPageHeaderLegacyVariant;
  titleSuppressHydrationWarning?: boolean;
  metaSuppressHydrationWarning?: boolean;
  className?: string;
};

type ResolvedVariant = DashboardPageHeaderVariant;

function HeaderActions({
  actions,
  variant,
}: {
  actions: ReactNode | DashboardPageHeaderAction[];
  variant: ResolvedVariant;
}) {
  if (Array.isArray(actions)) {
    return (
      <div className="page-header-actions">
        {actions.map((action) => {
          const Icon = action.icon;
          const isPrimary = action.variant !== 'secondary';
          const className =
            variant === 'hero'
              ? isPrimary
                ? 'dash-hero-cta-primary'
                : 'dash-hero-cta-secondary'
              : isPrimary
                ? 'btn-primary inline-flex items-center gap-2'
                : 'btn-secondary inline-flex items-center gap-2';

          return (
            <Link key={`${action.href}-${action.label}`} href={action.href} className={className}>
              {Icon ? <Icon className="h-4 w-4" strokeWidth={1.75} /> : null}
              {action.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return <div className="page-header-actions">{actions}</div>;
}

function HeaderBadges({ badges, variant }: { badges: DashboardPageHeaderBadge[]; variant: ResolvedVariant }) {
  if (!badges.length) return null;

  if (variant === 'hero') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {badges.map((badge, index) => {
          const Icon = badge.icon;
          if (badge.bare) {
            return <span key={index}>{badge.label}</span>;
          }
          return (
            <span
              key={index}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm"
            >
              {badge.prefix ? <span aria-hidden>{badge.prefix}</span> : null}
              {Icon ? <Icon className="h-3 w-3 text-white/80" aria-hidden /> : null}
              {badge.label}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {badges.map((badge, index) => {
        const Icon = badge.icon;
        if (badge.bare) {
          return <span key={index}>{badge.label}</span>;
        }
        return (
          <span
            key={index}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--dash-text-body)]"
          >
            {badge.prefix ? <span aria-hidden>{badge.prefix}</span> : null}
            {Icon ? <Icon className="h-3 w-3 text-primary-600" aria-hidden /> : null}
            {badge.label}
          </span>
        );
      })}
    </div>
  );
}

function PanelPageHeader({
  title,
  TitleIcon,
  iconClassName,
  description,
  eyebrow,
  meta,
  badges,
  actions,
  footer,
  hasActions,
  titleSuppressHydrationWarning,
  metaSuppressHydrationWarning,
  className,
}: {
  title: ReactNode;
  TitleIcon?: LucideIcon;
  iconClassName?: string;
  description?: ReactNode;
  eyebrow?: string;
  meta?: ReactNode;
  badges: DashboardPageHeaderBadge[];
  actions?: ReactNode | DashboardPageHeaderAction[];
  footer?: ReactNode;
  hasActions: boolean;
  titleSuppressHydrationWarning?: boolean;
  metaSuppressHydrationWarning?: boolean;
  className?: string;
}) {
  return (
    <section className={cn('dashboard-surface overflow-hidden shadow-sm', className)}>
      <header className={cn(DASHBOARD_PAGE_HEADER_CLASS, 'px-5 py-5 sm:px-6')}>
        <div className="page-header-body min-w-0 space-y-2">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700 dark:text-[var(--dash-text-subtle)]">
              {eyebrow}
            </p>
          ) : null}
          {badges.length > 0 ? <HeaderBadges badges={badges} variant="panel" /> : null}
          <h1
            className={cn('page-title', TitleIcon && 'flex items-center gap-2')}
            suppressHydrationWarning={titleSuppressHydrationWarning}
          >
            {TitleIcon ? (
              <TitleIcon
                className={iconClassName ?? 'h-7 w-7 shrink-0 text-primary-600'}
                strokeWidth={1.75}
                aria-hidden
              />
            ) : null}
            {title}
          </h1>
          {description ? <div className="page-description max-w-2xl !mt-0">{description}</div> : null}
          {meta ? (
            <div
              className="text-xs text-[var(--dash-text-muted)]"
              suppressHydrationWarning={metaSuppressHydrationWarning}
            >
              {meta}
            </div>
          ) : null}
        </div>
        {hasActions && actions ? <HeaderActions actions={actions} variant="panel" /> : null}
      </header>
      {footer ? (
        <div className="border-t border-[var(--dash-border-subtle)] bg-[var(--dash-surface-muted)] px-5 py-3 sm:px-6">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Standard page header for dashboard routes.
 * - `panel` (default) — enclosed surface card with title, embedded actions, and optional footer strip
 * - `hero` — navy gradient welcome band (main command center overview only)
 */
export function DashboardPageHeader({
  title,
  icon,
  iconClassName,
  description,
  eyebrow,
  meta,
  badges = [],
  actions,
  footer,
  href,
  variant = 'panel',
  titleSuppressHydrationWarning,
  metaSuppressHydrationWarning,
  className,
}: DashboardPageHeaderProps) {
  const pathname = usePathname();
  const routeKey = href ?? pathname ?? '/dashboard';
  const resolvedVariant: ResolvedVariant = variant === 'hero' ? 'hero' : 'panel';
  const showIcon = resolvedVariant === 'hero' || isMainDashboardPage(routeKey);
  const TitleIcon =
    showIcon && icon !== false ? icon || resolveDashboardPageIcon(routeKey) : undefined;
  const hasActions = actions != null && (Array.isArray(actions) ? actions.length > 0 : true);

  if (resolvedVariant === 'hero') {
    return (
      <section
        className={cn(
          'dashboard-page-header-hero relative overflow-hidden rounded-2xl border p-5 shadow-lg sm:p-6',
          className,
        )}
      >
        <div
          className="dashboard-page-header-hero-glow-tr pointer-events-none absolute -right-10 -top-12 h-56 w-56 rounded-full blur-3xl"
          aria-hidden
        />
        <div
          className="dashboard-page-header-hero-glow-bl pointer-events-none absolute -bottom-16 left-1/4 h-44 w-44 rounded-full blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">{eyebrow}</p>
            ) : null}
            <HeaderBadges badges={badges} variant="hero" />
            <div>
              <h1
                className={cn(
                  'text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]',
                  TitleIcon && 'flex items-center gap-2.5',
                )}
                suppressHydrationWarning={titleSuppressHydrationWarning}
              >
                {TitleIcon ? (
                  <TitleIcon className="h-7 w-7 shrink-0 text-white/90" strokeWidth={1.75} aria-hidden />
                ) : null}
                {title}
              </h1>
              {description ? (
                <div className="mt-2 max-w-2xl text-sm leading-relaxed text-white/90">{description}</div>
              ) : null}
            </div>
            {meta ? (
              <div className="text-xs text-white/70" suppressHydrationWarning={metaSuppressHydrationWarning}>
                {meta}
              </div>
            ) : null}
          </div>
          {hasActions && actions ? <HeaderActions actions={actions} variant="hero" /> : null}
        </div>
      </section>
    );
  }

  return (
    <PanelPageHeader
      title={title}
      TitleIcon={TitleIcon}
      iconClassName={iconClassName}
      description={description}
      eyebrow={eyebrow}
      meta={meta}
      badges={badges}
      actions={actions}
      footer={footer}
      hasActions={hasActions}
      titleSuppressHydrationWarning={titleSuppressHydrationWarning}
      metaSuppressHydrationWarning={metaSuppressHydrationWarning}
      className={className}
    />
  );
}
