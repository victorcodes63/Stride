'use client';

import { AlertCircle, Loader2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export type DashboardAsyncStatus = 'loading' | 'error' | 'empty' | 'success';

export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'table-empty-state flex min-h-[200px] flex-col items-center justify-center gap-2 px-4 py-10 text-center',
        className,
      )}
    >
      {Icon ? <Icon className="h-8 w-8 text-neutral-300" aria-hidden /> : null}
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {description ? <p className="max-w-sm text-sm text-neutral-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

type SkeletonVariant = 'list' | 'detail' | 'stats';

export function DashboardPageSkeleton({ variant = 'list' }: { variant?: SkeletonVariant }) {
  if (variant === 'stats') {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="dashboard-stat-card animate-pulse">
            <div className="mb-2 h-3 w-20 rounded bg-neutral-200" />
            <div className="h-7 w-16 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="dashboard-surface animate-pulse p-6">
        <div className="mb-4 h-5 w-48 rounded bg-neutral-200" />
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-neutral-100" />
          <div className="h-4 w-5/6 rounded bg-neutral-100" />
          <div className="h-4 w-2/3 rounded bg-neutral-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-surface animate-pulse overflow-hidden">
      <div className="border-b border-neutral-200/80 px-4 py-4 sm:px-5">
        <div className="h-9 w-full max-w-md rounded-lg bg-neutral-200" />
      </div>
      <div className="space-y-0 px-4 py-3 sm:px-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-neutral-100 py-3 last:border-0">
            <div className="h-4 flex-1 rounded bg-neutral-100" />
            <div className="h-4 w-24 rounded bg-neutral-100" />
            <div className="h-4 w-20 rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardAsyncState({
  status,
  error,
  onRetry,
  empty,
  loading,
  children,
}: {
  status: DashboardAsyncStatus;
  error?: string | null;
  onRetry?: () => void;
  empty?: ReactNode;
  loading?: ReactNode;
  children: ReactNode;
}) {
  if (status === 'loading') {
    return <>{loading ?? <DashboardPageSkeleton variant="list" />}</>;
  }

  if (status === 'error') {
    return (
      <div className="dashboard-surface flex flex-col items-center gap-3 px-6 py-10 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" aria-hidden />
        <p className="text-sm font-medium text-neutral-800">Something went wrong</p>
        <p className="max-w-md text-sm text-neutral-500">
          {error || 'We could not load this page. Please try again.'}
        </p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="btn-secondary mt-1">
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (status === 'empty') {
    return <>{empty ?? <DashboardEmptyState title="Nothing here yet" />}</>;
  }

  return <>{children}</>;
}

/** Inline loading indicator for sections inside an already-rendered page. */
export function DashboardInlineLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
