import type { DashStatusTone } from '@/lib/dashboard-status-chips';

/** Maps a 1–5 performance score to a semantic status tone used across chips, bars, and badges. */
export function scoreTone(score: number | null | undefined): DashStatusTone {
  if (score == null) return 'neutral';
  if (score >= 4.5) return 'success';
  if (score >= 3.5) return 'info';
  if (score >= 2.5) return 'primary';
  if (score >= 1.5) return 'warning';
  return 'danger';
}

const TONE_ACCENT: Record<DashStatusTone, string> = {
  success: 'var(--swatch-emerald-accent)',
  info: 'var(--swatch-sky-accent)',
  primary: 'var(--swatch-coral-accent)',
  warning: 'var(--swatch-amber-accent)',
  danger: 'var(--swatch-rose-accent)',
  neutral: 'var(--dash-text-subtle)',
};

/** CSS color for a semantic tone — use for SVG/CSS chart fills. */
export function toneAccent(tone: DashStatusTone): string {
  return TONE_ACCENT[tone];
}

/** CSS color for a 1–5 score. */
export function scoreAccent(score: number | null | undefined): string {
  return TONE_ACCENT[scoreTone(score)];
}
