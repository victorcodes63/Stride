/**
 * Canonical Stride platform colour swatches for dashboard UI.
 * These are product-level tokens — not overridden by tenant company-setup colours.
 * Tenant primary/secondary colours apply to documents, careers, and payslips only.
 */

import { DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR } from '@/lib/brand-theme';

/** Core Stride brand palette (pitch / brand pack). */
export const STRIDE_CORE = {
  coral: DEFAULT_PRIMARY_COLOR,
  ink: DEFAULT_SECONDARY_COLOR,
  paper: '#FBF8F4',
  logo: '#FF5436',
} as const;

/** Functional dashboard accents — KPI cards, attention items, stat strips. */
export const STRIDE_DASHBOARD_SWATCHES = {
  sky: {
    bg: '#E0F2FE',
    fg: '#0369A1',
    accent: '#0EA5E9',
    border: '#BAE6FD',
  },
  emerald: {
    bg: '#DCFCE7',
    fg: '#15803D',
    accent: '#10B981',
    border: '#BBF7D0',
  },
  amber: {
    bg: '#FEF3C7',
    fg: '#B45309',
    accent: '#F59E0B',
    border: '#FDE68A',
  },
  violet: {
    bg: '#EDE9FE',
    fg: '#6D28D9',
    accent: '#8B5CF6',
    border: '#DDD6FE',
  },
  rose: {
    bg: '#FFE4E6',
    fg: '#BE123C',
    accent: '#F43F5E',
    border: '#FECDD3',
  },
  yellow: {
    bg: '#FEF9C3',
    fg: '#A16207',
    accent: '#EAB308',
    border: '#FEF08A',
  },
  coral: {
    bg: '#FFE9E4',
    fg: '#C9341B',
    accent: STRIDE_CORE.coral,
    border: '#FFC9BE',
  },
} as const;

export type DashboardSwatchKey = keyof typeof STRIDE_DASHBOARD_SWATCHES;

/** CSS custom properties injected on the dashboard shell. */
export function buildPlatformSwatchCssVars(): Record<string, string> {
  const vars: Record<string, string> = {
    '--stride-coral': STRIDE_CORE.coral,
    '--stride-ink': STRIDE_CORE.ink,
    '--stride-paper': STRIDE_CORE.paper,
    '--stride-logo': STRIDE_CORE.logo,
  };

  for (const [key, swatch] of Object.entries(STRIDE_DASHBOARD_SWATCHES)) {
    vars[`--swatch-${key}-bg`] = swatch.bg;
    vars[`--swatch-${key}-fg`] = swatch.fg;
    vars[`--swatch-${key}-accent`] = swatch.accent;
    vars[`--swatch-${key}-border`] = swatch.border;
  }

  return vars;
}

/** Stat card tone classes — used by DashboardStatGrid. */
export const DASHBOARD_STAT_TONE_CLASSES = {
  primary: {
    bar: 'bg-[var(--swatch-coral-accent)]',
    wash: 'from-[color-mix(in_srgb,var(--swatch-coral-bg)_80%,var(--dash-surface-solid))] to-[var(--dash-surface-solid)]',
  },
  success: {
    bar: 'bg-[var(--swatch-emerald-accent)]',
    wash: 'from-[color-mix(in_srgb,var(--swatch-emerald-bg)_70%,var(--dash-surface-solid))] to-[var(--dash-surface-solid)]',
  },
  warning: {
    bar: 'bg-[var(--swatch-amber-accent)]',
    wash: 'from-[color-mix(in_srgb,var(--swatch-amber-bg)_80%,var(--dash-surface-solid))] to-[var(--dash-surface-solid)]',
    value: 'text-[var(--swatch-amber-fg)]',
  },
  violet: {
    bar: 'bg-[var(--swatch-violet-accent)]',
    wash: 'from-[color-mix(in_srgb,var(--swatch-violet-bg)_70%,var(--dash-surface-solid))] to-[var(--dash-surface-solid)]',
  },
  sky: {
    bar: 'bg-[var(--swatch-sky-accent)]',
    wash: 'from-[color-mix(in_srgb,var(--swatch-sky-bg)_70%,var(--dash-surface-solid))] to-[var(--dash-surface-solid)]',
  },
} as const;

export type DashboardStatTone = keyof typeof DASHBOARD_STAT_TONE_CLASSES;

/** Overview KPI card variants. */
export const DASHBOARD_KPI_CLASSES = {
  primary: {
    card: 'border-[var(--swatch-coral-border)]/60 bg-gradient-to-br from-[var(--dash-surface-solid)] via-[var(--dash-surface-solid)] to-[color-mix(in_srgb,var(--swatch-coral-bg)_80%,var(--dash-surface-solid))] hover:border-[var(--swatch-coral-accent)]/40 hover:shadow-[var(--swatch-coral-bg)]/40',
    icon: 'bg-[color-mix(in_srgb,var(--swatch-coral-accent)_15%,var(--dash-surface-solid))] text-[var(--swatch-coral-fg)] ring-1 ring-[var(--swatch-coral-accent)]/20',
    value: 'text-[var(--dash-text-strong)]',
  },
  emerald: {
    card: 'border-[var(--swatch-emerald-border)]/60 bg-gradient-to-br from-[var(--dash-surface-solid)] via-[var(--dash-surface-solid)] to-[color-mix(in_srgb,var(--swatch-emerald-bg)_70%,var(--dash-surface-solid))] hover:border-[var(--swatch-emerald-accent)]/40 hover:shadow-[var(--swatch-emerald-bg)]/40',
    icon: 'bg-[color-mix(in_srgb,var(--swatch-emerald-accent)_15%,var(--dash-surface-solid))] text-[var(--swatch-emerald-fg)] ring-1 ring-[var(--swatch-emerald-accent)]/20',
    value: 'text-[var(--swatch-emerald-fg)]',
  },
  amber: {
    card: 'border-[var(--swatch-amber-border)]/60 bg-gradient-to-br from-[var(--dash-surface-solid)] via-[var(--dash-surface-solid)] to-[color-mix(in_srgb,var(--swatch-amber-bg)_70%,var(--dash-surface-solid))] hover:border-[var(--swatch-amber-accent)]/40 hover:shadow-[var(--swatch-amber-bg)]/40',
    icon: 'bg-[color-mix(in_srgb,var(--swatch-amber-accent)_15%,var(--dash-surface-solid))] text-[var(--swatch-amber-fg)] ring-1 ring-[var(--swatch-amber-accent)]/20',
    value: 'text-[var(--swatch-amber-fg)]',
  },
  violet: {
    card: 'border-[var(--swatch-violet-border)]/60 bg-gradient-to-br from-[var(--dash-surface-solid)] via-[var(--dash-surface-solid)] to-[color-mix(in_srgb,var(--swatch-violet-bg)_70%,var(--dash-surface-solid))] hover:border-[var(--swatch-violet-accent)]/40 hover:shadow-[var(--swatch-violet-bg)]/40',
    icon: 'bg-[color-mix(in_srgb,var(--swatch-violet-accent)_15%,var(--dash-surface-solid))] text-[var(--swatch-violet-fg)] ring-1 ring-[var(--swatch-violet-accent)]/20',
    value: 'text-[var(--swatch-violet-fg)]',
  },
} as const;

export type DashboardKpiVariant = keyof typeof DASHBOARD_KPI_CLASSES;

/** Overview “needs attention” row tones. */
export function attentionSwatchClass(tone: 'amber' | 'rose' | 'sky' | 'neutral'): string {
  switch (tone) {
    case 'amber':
      return 'border-[var(--swatch-amber-border)]/50 bg-gradient-to-r from-[var(--swatch-amber-bg)] to-[color-mix(in_srgb,var(--swatch-amber-bg)_40%,var(--dash-surface-solid))] text-[var(--swatch-amber-fg)] shadow-sm shadow-[var(--swatch-amber-bg)]/50';
    case 'rose':
      return 'border-[var(--swatch-rose-border)]/50 bg-gradient-to-r from-[var(--swatch-rose-bg)] to-[color-mix(in_srgb,var(--swatch-rose-bg)_40%,var(--dash-surface-solid))] text-[var(--swatch-rose-fg)] shadow-sm shadow-[var(--swatch-rose-bg)]/50';
    case 'sky':
      return 'border-[var(--swatch-sky-border)]/50 bg-gradient-to-r from-[var(--swatch-sky-bg)] to-[color-mix(in_srgb,var(--swatch-sky-bg)_40%,var(--dash-surface-solid))] text-[var(--swatch-sky-fg)] shadow-sm shadow-[var(--swatch-sky-bg)]/50';
    default:
      return 'border-[var(--dash-border)] bg-gradient-to-r from-[var(--dash-surface-muted)] to-[var(--dash-surface-solid)] text-[var(--dash-text-strong)]';
  }
}
