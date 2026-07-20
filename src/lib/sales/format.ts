/** Sales Performance — shared display formatters. */

/** e.g. 4,370,000 KES */
export function formatSalesCurrency(amount: number, currency = 'KES'): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${Math.round(n).toLocaleString('en-KE')} ${currency}`;
}

/** Compact currency for chart axes / tight cards, e.g. 4.4M KES. */
export function formatCompactCurrency(amount: number, currency = 'KES'): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B ${currency}`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M ${currency}`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K ${currency}`;
  return `${sign}${Math.round(abs).toLocaleString('en-KE')} ${currency}`;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits).replace(/\.0+$/, '')}%`;
}

/** ISO date/datetime -> localized short date. */
export function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Relative "time ago" for activity timelines. */
export function formatRelativeTime(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}
