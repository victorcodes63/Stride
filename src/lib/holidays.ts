import { prisma } from '@/lib/prisma';

type HolidayResult = { isHoliday: boolean; holidayName?: string };

type CachedYear = {
  loadedAt: number;
  items: Array<{ dateKey: string; name: string }>;
};

const YEAR_CACHE = new Map<number, CachedYear>();
const YEAR_CACHE_TTL_MS = 5 * 60 * 1000;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fromDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function normalizeDateRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

async function isPublicHolidayDirect(date: Date): Promise<HolidayResult> {
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const { start, end } = normalizeDateRange(date);

  const specific = await prisma.publicHoliday.findFirst({
    where: {
      isActive: true,
      recurring: false,
      date: { gte: start, lte: end },
    },
    select: { name: true },
  });
  if (specific) return { isHoliday: true, holidayName: specific.name };

  const recurring = await prisma.publicHoliday.findFirst({
    where: { isActive: true, recurring: true, recurDay: day, recurMonth: month },
    select: { name: true },
  });
  if (recurring) return { isHoliday: true, holidayName: recurring.name };

  return { isHoliday: false };
}

export async function isPublicHoliday(date: Date): Promise<HolidayResult> {
  const direct = await isPublicHolidayDirect(date);
  if (direct.isHoliday) return direct;

  if (date.getUTCDay() === 1) {
    const sunday = new Date(date);
    sunday.setUTCDate(sunday.getUTCDate() - 1);
    const sundayMatch = await isPublicHolidayDirect(sunday);
    if (sundayMatch.isHoliday) {
      return { isHoliday: true, holidayName: `${sundayMatch.holidayName} (substitute)` };
    }
  }

  return { isHoliday: false };
}

export async function getHolidaysForYear(year: number): Promise<{ date: Date; name: string }[]> {
  const cached = YEAR_CACHE.get(year);
  if (cached && Date.now() - cached.loadedAt < YEAR_CACHE_TTL_MS) {
    return cached.items.map((item) => ({ date: fromDateKey(item.dateKey), name: item.name }));
  }

  const holidays: Array<{ date: Date; name: string }> = [];

  const specific = await prisma.publicHoliday.findMany({
    where: {
      isActive: true,
      recurring: false,
      date: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    select: { name: true, date: true },
  });
  for (const h of specific) {
    if (h.date) holidays.push({ date: h.date, name: h.name });
  }

  const recurring = await prisma.publicHoliday.findMany({
    where: { isActive: true, recurring: true },
    select: { name: true, recurDay: true, recurMonth: true },
  });
  for (const h of recurring) {
    if (!h.recurDay || !h.recurMonth) continue;
    const date = new Date(Date.UTC(year, h.recurMonth - 1, h.recurDay));
    holidays.push({ date, name: h.name });
    if (date.getUTCDay() === 0) {
      const substitute = new Date(date);
      substitute.setUTCDate(substitute.getUTCDate() + 1);
      holidays.push({ date: substitute, name: `${h.name} (substitute)` });
    }
  }

  holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
  YEAR_CACHE.set(year, {
    loadedAt: Date.now(),
    items: holidays.map((h) => ({ dateKey: toDateKey(h.date), name: h.name })),
  });

  return holidays;
}

export function clearHolidayCache(year?: number): void {
  if (typeof year === 'number') {
    YEAR_CACHE.delete(year);
    return;
  }
  YEAR_CACHE.clear();
}

export async function doesShiftTouchPublicHoliday(
  clockIn: Date | null,
  clockOut: Date | null
): Promise<HolidayResult> {
  if (!clockIn || !clockOut || clockOut.getTime() <= clockIn.getTime()) {
    return { isHoliday: false };
  }

  // Simpler policy for now: if any portion of the shift falls on a holiday, apply holiday rate.
  // Alternative is split-rate computation by midnight boundaries.
  const probe = new Date(clockIn);
  probe.setUTCHours(0, 0, 0, 0);
  const end = new Date(clockOut);
  end.setUTCHours(0, 0, 0, 0);

  while (probe.getTime() <= end.getTime()) {
    const holiday = await isPublicHoliday(probe);
    if (holiday.isHoliday) return holiday;
    probe.setUTCDate(probe.getUTCDate() + 1);
  }

  return { isHoliday: false };
}
