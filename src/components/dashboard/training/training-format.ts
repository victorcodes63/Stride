import type { TrainingProgramSummary } from '@/lib/training/types';

/** Format a yyyy-mm-dd (or ISO) date string into a short, human-readable label. */
export function formatTrainingDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Render a start–end date range, gracefully handling missing bounds. */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start && !end) return '—';
  if (start && end) return `${formatTrainingDate(start)} – ${formatTrainingDate(end)}`;
  if (start) return `From ${formatTrainingDate(start)}`;
  return `Until ${formatTrainingDate(end)}`;
}

/** Format a cost amount with its ISO currency code (null-safe). */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount == null) return '—';
  const code = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString()}`;
  }
}

/** Format a duration expressed in hours (null-safe). */
export function formatDuration(hours: number | null | undefined): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours} hr${hours === 1 ? '' : 's'}`;
}

/** Format a numeric score as a whole/percentage-ish value (null-safe). */
export function formatScore(score: number | null | undefined): string {
  if (score == null) return '—';
  return `${Number.isInteger(score) ? score : score.toFixed(1)}`;
}

/** Completion rate as a rounded percentage (0 when nobody enrolled). */
export function completionRate(enrolled: number, completed: number): number {
  if (!enrolled) return 0;
  return Math.round((completed / enrolled) * 100);
}

/** Where the training happens — "Online" or the physical location. */
export function formatDelivery(program: {
  isOnline: boolean;
  location: string | null;
}): string {
  if (program.isOnline) return 'Online / virtual';
  return program.location?.trim() || 'Location TBD';
}

/** Build de-duplicated, sorted category options from loaded programs. */
export function collectCategories(programs: TrainingProgramSummary[]): string[] {
  const set = new Set<string>();
  for (const program of programs) {
    const category = program.category?.trim();
    if (category) set.add(category);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
