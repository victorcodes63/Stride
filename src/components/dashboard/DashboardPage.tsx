import type { ReactNode } from 'react';
import { DASHBOARD_PAGE_SHELL_CLASS } from '@/lib/dashboard-layout';

export { DashboardPageHeader } from './DashboardPageHeader';
export type {
  DashboardPageHeaderAction,
  DashboardPageHeaderBadge,
  DashboardPageHeaderProps,
  DashboardPageHeaderVariant,
} from './DashboardPageHeader';

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/** Standard vertical rhythm wrapper for dashboard routes. */
export function DashboardPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(DASHBOARD_PAGE_SHELL_CLASS, className)}>{children}</div>;
}

/** Optional labeled block inside a page — keeps section spacing consistent. */
export function DashboardPageSection({
  children,
  className,
  title,
  description,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <section className={cn('min-w-0 w-full', className)}>
      {title ? (
        <header className="mb-3">
          <h2 className="dash-section-title text-sm font-semibold text-[var(--dash-text-strong)]">{title}</h2>
          {description ? (
            <p className="dash-section-desc mt-0.5 text-xs text-[var(--dash-text-muted)]">{description}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** @deprecated Prefer `DashboardPageHeader` with `title` and `description` props. */
export function DashboardPageTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h1 className={cn('page-title', className)}>{children}</h1>;
}

/** @deprecated Prefer `DashboardPageHeader` with `description` prop. */
export function DashboardPageDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn('page-description', className)}>{children}</p>;
}
