'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export type DashboardTabItem<T extends string = string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  hidden?: boolean;
};

export type DashboardTabsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  items: DashboardTabItem<T>[];
  className?: string;
  /** When true, omits bottom border — for use inside a panel header footer. */
  embedded?: boolean;
};

/** Horizontal tab bar for in-page navigation (sync with `useDashboardTabParam`). */
export function DashboardTabs<T extends string>({
  value,
  onChange,
  items,
  className,
  embedded = false,
}: DashboardTabsProps<T>) {
  const visible = items.filter((item) => !item.hidden);
  if (visible.length === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap gap-2',
        !embedded && 'border-b border-[var(--dash-border)] pb-2',
        className,
      )}
      role="tablist"
      aria-label="Page sections"
    >
      {visible.map((item) => {
        const Icon = item.icon;
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary-100 text-primary-900 shadow-sm'
                : 'text-[var(--dash-text-muted)] hover:bg-primary-50/60',
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
            <span>{item.label}</span>
            {item.badge ? <span className="shrink-0">{item.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
