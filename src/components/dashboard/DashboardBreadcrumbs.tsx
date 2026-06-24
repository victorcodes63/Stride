'use client';

import Link from 'next/link';
import type { DashboardBreadcrumb } from '@/lib/dashboard-breadcrumbs';

type DashboardBreadcrumbsProps = {
  crumbs: DashboardBreadcrumb[];
  className?: string;
};

export function DashboardBreadcrumbs({ crumbs, className = '' }: DashboardBreadcrumbsProps) {
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`min-w-0 ${className}`}>
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <span className="text-neutral-300 select-none" aria-hidden>
                  /
                </span>
              ) : null}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="truncate font-medium text-primary-700 hover:text-primary-800 hover:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={`truncate ${isLast ? 'font-medium text-ink' : 'text-neutral-600'}`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
