'use client';

import { Palette } from 'lucide-react';
import { DashboardThemeToggle } from '@/components/dashboard/DashboardThemeToggle';
import { DASHBOARD_APPEARANCE_OPTIONS } from '@/lib/dashboard-appearance';

export function AppearanceSettings() {
  return (
    <section id="appearance" className="dashboard-surface shadow-sm p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--swatch-violet-accent)_15%,var(--dash-surface-solid))] text-[var(--swatch-violet-fg)]">
          <Palette className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[var(--dash-text-strong)]">Appearance</h2>
          <p className="mt-0.5 text-sm text-[var(--dash-text-muted)]">
            Choose light or dark mode for the dashboard. Your preference is saved on this device.
          </p>
        </div>
      </div>

      <DashboardThemeToggle variant="segmented" className="w-full sm:w-auto" />

      <ul className="grid gap-2 sm:grid-cols-3 text-xs text-[var(--dash-text-muted)]">
        {DASHBOARD_APPEARANCE_OPTIONS.map((opt) => (
          <li
            key={opt.value}
            className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-3 py-2"
          >
            <span className="font-medium text-[var(--dash-text-strong)]">{opt.label}</span>
            <span className="mt-0.5 block">{opt.description}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
