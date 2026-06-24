/** Calendar helpers in Africa/Nairobi for contract reminders and scheduler day boundaries. */

const TZ = 'Africa/Nairobi';

function intlParts(d: Date, timeZone: string): { y: number; m: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { y: get('year'), m: get('month'), day: get('day') };
}

/** YYYY-MM-DD for the given instant in Nairobi. */
export function nairobiYmd(d: Date = new Date()): string {
  const { y, m, day } = intlParts(d, TZ);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Date-only from Prisma @db.Date (UTC midnight representing that calendar day). */
export function prismaDateToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function ymdToUtcNoon(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** Whole calendar days from `fromYmd` to `toYmd` (can be negative). */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const a = ymdToUtcNoon(fromYmd).getTime();
  const b = ymdToUtcNoon(toYmd).getTime();
  return Math.round((b - a) / 86400000);
}

/** Add calendar months to a YMD (month-end clamping via Date UTC). */
export function addCalendarMonthsYmd(ymd: string, deltaMonths: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, d, 12, 0, 0));
  const yy = dt.getUTCFullYear();
  const mm = dt.getUTCMonth() + 1;
  const dd = dt.getUTCDate();
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
