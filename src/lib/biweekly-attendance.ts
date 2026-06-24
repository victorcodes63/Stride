/**
 * Bi-weekly payslip attendance: working week Mon–Sat (Sunday off).
 * Period 1 = calendar days 1–15, period 2 = 16–end of month.
 */

export type BiweeklyAttendance = {
  period1: string[];
  period2: string[];
};

export function emptyAttendance(): BiweeklyAttendance {
  return { period1: [], period2: [] };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toYmd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Monday=1 … Saturday=6, Sunday=0 — we count Mon–Sat as working days */
function isWorkingDayJs(date: Date): boolean {
  const d = date.getDay();
  return d !== 0; // not Sunday
}

/**
 * All Mon–Sat dates in [dayStart, dayEnd] inclusive for that month.
 */
export function workingDaysInPeriod(
  year: number,
  month: number,
  period: 1 | 2
): string[] {
  const lastDay = new Date(year, month, 0).getDate();
  const start = period === 1 ? 1 : 16;
  const end = period === 1 ? Math.min(15, lastDay) : lastDay;
  const out: string[] = [];
  for (let day = start; day <= end; day++) {
    const dt = new Date(year, month - 1, day);
    if (isWorkingDayJs(dt)) out.push(toYmd(year, month, day));
  }
  return out;
}

export function normalizeAttendance(
  raw: unknown,
  year: number,
  month: number
): BiweeklyAttendance {
  const allowed1 = new Set(workingDaysInPeriod(year, month, 1));
  const allowed2 = new Set(workingDaysInPeriod(year, month, 2));
  const p1: string[] = [];
  const p2: string[] = [];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const a1 = Array.isArray(o.period1) ? o.period1 : [];
    const a2 = Array.isArray(o.period2) ? o.period2 : [];
    for (const x of a1) {
      if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && allowed1.has(x) && !p1.includes(x))
        p1.push(x);
    }
    for (const x of a2) {
      if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && allowed2.has(x) && !p2.includes(x))
        p2.push(x);
    }
  }
  p1.sort();
  p2.sort();
  return { period1: p1, period2: p2 };
}

/**
 * Pro-rate each period's gross: fullPeriodGross * (present / workingDaysInPeriod).
 * fullPeriodGross defaults to half of monthlyBasic when not passed.
 */
export function proRatedPeriodGrosses(params: {
  year: number;
  month: number;
  attendance: BiweeklyAttendance;
  monthlyBasic: number;
  /** If set, use as "full pay" for P1/P2 instead of monthlyBasic/2 */
  fullPeriod1Gross?: number;
  fullPeriod2Gross?: number;
}): { period1Gross: number; period2Gross: number } {
  const wd1 = workingDaysInPeriod(params.year, params.month, 1).length;
  const wd2 = workingDaysInPeriod(params.year, params.month, 2).length;
  const p1 = params.attendance.period1.length;
  const p2 = params.attendance.period2.length;
  const half = params.monthlyBasic / 2;
  const full1 = params.fullPeriod1Gross ?? half;
  const full2 = params.fullPeriod2Gross ?? half;
  const g1 = wd1 <= 0 ? 0 : Math.round((full1 * p1) / wd1);
  const g2 = wd2 <= 0 ? 0 : Math.round((full2 * p2) / wd2);
  return { period1Gross: g1, period2Gross: g2 };
}

export function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
}
