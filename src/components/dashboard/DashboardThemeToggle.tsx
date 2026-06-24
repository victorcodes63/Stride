'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { DashboardAppearance } from '@/lib/dashboard-appearance';

const iconBtnClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg dash-icon-btn transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30';

type DashboardThemeToggleProps = {
  /** Compact icon-only cycle (topbar). */
  variant?: 'icon' | 'segmented';
  className?: string;
};

function nextAppearance(current: string | undefined): DashboardAppearance {
  if (current === 'light') return 'dark';
  if (current === 'dark') return 'system';
  return 'light';
}

export function DashboardThemeToggle({ variant = 'icon', className = '' }: DashboardThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button type="button" className={`${iconBtnClass} ${className}`} aria-label="Appearance" disabled>
        <Sun className="h-[18px] w-[18px] opacity-40" strokeWidth={1.75} />
      </button>
    );
  }

  const active = (theme ?? 'system') as DashboardAppearance;
  const resolved = resolvedTheme ?? 'light';

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-0.5 ${className}`}
        role="radiogroup"
        aria-label="Appearance"
      >
        {(
          [
            { value: 'light' as const, icon: Sun, label: 'Light' },
            { value: 'dark' as const, icon: Moon, label: 'Dark' },
            { value: 'system' as const, icon: Monitor, label: 'System' },
          ] as const
        ).map(({ value, icon: Icon, label }) => {
          const isActive = active === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setTheme(value)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--dash-surface-solid)] text-[var(--dash-text-strong)] shadow-sm'
                  : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text-strong)]'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  const Icon = resolved === 'dark' ? Moon : Sun;
  const label =
    active === 'system'
      ? `Appearance: system (${resolved})`
      : `Appearance: ${active}`;

  return (
    <button
      type="button"
      className={`${iconBtnClass} ${className}`}
      onClick={() => setTheme(nextAppearance(theme))}
      title={label}
      aria-label={label}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </button>
  );
}
