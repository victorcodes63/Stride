'use client';

import { type ComponentType, type ReactNode } from 'react';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';

type SalesEmptyStateProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
};

/** Consistent empty-state card for Sales lists/boards. */
export function SalesEmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: SalesEmptyStateProps) {
  return (
    <div className={`${DASHBOARD_SURFACE_CLASS} px-6 text-center ${compact ? 'py-10' : 'py-16'}`}>
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--stride-coral)]/10 text-[var(--stride-coral)]">
        <Icon className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-[var(--dash-text-strong)]">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--dash-text-muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
