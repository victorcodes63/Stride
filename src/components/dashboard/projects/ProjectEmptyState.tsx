'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function ProjectEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--dash-border)] bg-[var(--dash-surface-muted)]/40 px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--stride-coral)]/10 text-[var(--stride-coral)]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--dash-text-muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ProjectSkeleton({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
          <div className="mb-3 h-3 w-1/3 rounded bg-[var(--dash-border)]" />
          <div className="h-2 w-full rounded bg-[var(--dash-border-subtle)]" />
          <div className="mt-2 h-2 w-2/3 rounded bg-[var(--dash-border-subtle)]" />
        </div>
      ))}
    </div>
  );
}

export function ProjectStatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3"
        >
          <div className="mb-2 h-2 w-12 rounded bg-[var(--dash-border)]" />
          <div className="h-5 w-10 rounded bg-[var(--dash-border)]" />
        </div>
      ))}
    </div>
  );
}
