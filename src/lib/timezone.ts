/**
 * Nairobi, Kenya timezone (UTC+3).
 * Use consistently for scheduling and displaying interview times.
 */
export const APP_TIMEZONE = 'Africa/Nairobi';

/**
 * Parse a datetime-local value (YYYY-MM-DDTHH:mm) as Nairobi time.
 * Returns a Date in UTC for storage. Use when the user selected a time
 * that should be interpreted as Nairobi (e.g. interview scheduling).
 */
export function parseDateTimeAsNairobi(localStr: string): Date {
  const trimmed = typeof localStr === 'string' ? localStr.trim() : '';
  if (!trimmed) return new Date(NaN);
  // datetime-local gives "YYYY-MM-DDTHH:mm" - append Nairobi offset
  const withTz = trimmed.includes('+') || trimmed.includes('Z') ? trimmed : `${trimmed}:00+03:00`;
  return new Date(withTz);
}

/**
 * Format a Date for display in Nairobi timezone.
 * Use for consistent display on interview pages, exports, emails.
 */
export function formatInNairobi(
  date: Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
): string {
  return date.toLocaleString('en-KE', { ...options, timeZone: APP_TIMEZONE });
}

/**
 * Convert UTC Date to datetime-local input value (YYYY-MM-DDTHH:mm) in Nairobi.
 * Use when populating datetime-local from stored ISO string.
 */
export function toDateTimeLocalNairobi(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const min = parts.find((p) => p.type === 'minute')?.value ?? '';
  return `${y}-${m}-${day}T${hour}:${min}`;
}

/**
 * Build a Date in Nairobi from date (YYYY-MM-DD) and time (HH:mm).
 * For server-side use (e.g. bulk schedule API).
 */
export function dateTimeNairobi(dateStr: string, timeStr: string): Date {
  const [h = 0, m = 0] = timeStr.split(':').map((x) => parseInt(x, 10) || 0);
  const combined = `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+03:00`;
  return new Date(combined);
}
