'use client';

import type { ButtonHTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { DASHBOARD_DATA_TABLE_CLASS, DASHBOARD_SURFACE_CLASS, DASHBOARD_TOOLBAR_CLASS } from '@/lib/dashboard-layout';

type Align = 'left' | 'center' | 'right';

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/** Outer card shell for list/table views. */
export function DashboardTableCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 w-full', DASHBOARD_SURFACE_CLASS, 'shadow-sm', className)}>
      {children}
    </div>
  );
}

/** Optional filter / search toolbar above the table. */
export function DashboardTableToolbar({
  label = 'Filters',
  children,
}: {
  label?: string | null;
  children: ReactNode;
}) {
  return (
    <div className={cn(DASHBOARD_TOOLBAR_CLASS, 'px-4 py-4 sm:px-5')}>
      {label ? (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      ) : null}
      {children}
    </div>
  );
}

/** Title row between toolbar and table body. */
export function DashboardTableMeta({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-neutral-200/80 dashboard-panel-header px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-neutral-500">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

/** Horizontal scroll container — keeps table usable on narrow viewports. */
export function DashboardTableViewport({
  children,
  minWidth = 880,
}: {
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="w-full overflow-x-auto [scrollbar-gutter:stable]">
      <div className="min-w-full" style={{ minWidth: `${minWidth}px` }}>
        {children}
      </div>
    </div>
  );
}

export function DashboardTable({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn(DASHBOARD_DATA_TABLE_CLASS, 'w-full', className)}>{children}</table>;
}

export function DashboardTableHead(props: ThHTMLAttributes<HTMLTableCellElement> & { align?: Align }) {
  const { align: _align, className, ...rest } = props;
  return <th className={className} {...rest} />;
}

export function DashboardTableCell(
  props: TdHTMLAttributes<HTMLTableCellElement> & { align?: Align; numeric?: boolean },
) {
  const { align: _align, numeric, className, ...rest } = props;
  return (
    <td
      data-numeric={numeric ? 'true' : undefined}
      className={cn(numeric && 'tabular-nums', className)}
      {...rest}
    />
  );
}

export function DashboardTableEmpty({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="table-empty-state min-h-[240px] border-0 px-4">
      {icon}
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {description ? <p className="max-w-sm text-center text-sm text-neutral-500">{description}</p> : null}
    </div>
  );
}

export function DashboardTableFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-neutral-200/80 bg-neutral-50/30 px-4 py-3 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      {children}
    </div>
  );
}

/** Keeps row action buttons on one line with consistent sizing. */
export function DashboardTableActions({ children }: { children: ReactNode }) {
  return <div className="inline-flex flex-nowrap items-center justify-center gap-1.5">{children}</div>;
}

type ActionVariant = 'secondary' | 'primary' | 'accent';

export function DashboardTableActionButton({
  children,
  variant = 'secondary',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ActionVariant }) {
  const variants: Record<ActionVariant, string> = {
    secondary: 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
    primary: 'border border-transparent bg-primary-900 text-white hover:bg-primary-800',
    accent: 'border border-transparent bg-amber-400 text-neutral-900 hover:bg-amber-500',
  };

  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Standard search input for table toolbars. */
export function DashboardTableSearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-neutral-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500/30',
        className,
      )}
    />
  );
}

export const dashboardTableSelectClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/30';
