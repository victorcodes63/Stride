import { dateTimeNairobi } from '@/lib/timezone';

export type BreakWindow = { startMs: number; endMs: number };

/** Parse break rows into non-overlapping-aware intervals (ms since epoch, Nairobi day). */
export function parseBreakWindows(
  dateStr: string,
  breaks: { time: string; durationMinutes: number }[]
): BreakWindow[] {
  const out: BreakWindow[] = [];
  for (const br of breaks) {
    const t = typeof br.time === 'string' ? br.time.trim() : '';
    if (!t || !/^\d{1,2}:\d{2}$/.test(t)) continue;
    const start = dateTimeNairobi(dateStr, t);
    if (Number.isNaN(start.getTime())) continue;
    const dm = Math.min(180, Math.max(5, Number(br.durationMinutes) || 15));
    out.push({ startMs: start.getTime(), endMs: start.getTime() + dm * 60 * 1000 });
  }
  return out;
}

/**
 * Next instant when an interview of durationMs can start without overlapping any break.
 * Interviews are placed back-to-back except breaks are treated as blocked time — slots resume after breaks.
 */
export function advancePastBreaks(slotStartMs: number, durationMs: number, breaks: BreakWindow[]): number {
  let s = slotStartMs;
  for (let guard = 0; guard < 100; guard++) {
    const end = s + durationMs;
    const hit = breaks.filter((b) => s < b.endMs && end > b.startMs);
    if (hit.length === 0) return s;
    s = Math.max(...hit.map((b) => b.endMs));
  }
  return s;
}

const HH_MM = /^\d{1,2}:\d{2}$/;

/**
 * Start time for each interview in **selection order**.
 * - Optional per-candidate `timesByApplicationId[appId] = "HH:mm"` pins that slot.
 * - Others chain from global start, skipping breaks; cursor advances after each interview so auto slots follow the previous end.
 */
export function computeBulkInterviewStartTimesWithCustom(
  dateStr: string,
  chainStartTimeStr: string,
  durationMinutes: number,
  applicationIdsInOrder: string[],
  breaks: { time: string; durationMinutes: number }[],
  timesByApplicationId: Record<string, string> | undefined
): Date[] {
  const breakWindows = parseBreakWindows(dateStr, breaks);
  const durMs = durationMinutes * 60 * 1000;
  let cursorMs = dateTimeNairobi(dateStr, chainStartTimeStr).getTime();
  if (Number.isNaN(cursorMs)) cursorMs = Date.now();
  const times = timesByApplicationId ?? {};
  const starts: Date[] = [];
  for (const appId of applicationIdsInOrder) {
    const custom = String(times[appId] ?? '').trim();
    let startMs: number;
    if (custom && HH_MM.test(custom)) {
      const d = dateTimeNairobi(dateStr, custom);
      startMs = Number.isNaN(d.getTime()) ? cursorMs : d.getTime();
    } else {
      startMs = advancePastBreaks(cursorMs, durMs, breakWindows);
    }
    starts.push(new Date(startMs));
    cursorMs = startMs + durMs;
  }
  return starts;
}

/**
 * Start time (Date) for each interview in order, avoiding break windows (all auto-chained).
 */
export function computeBulkInterviewStartTimes(
  dateStr: string,
  startTimeStr: string,
  durationMinutes: number,
  interviewCount: number,
  breaks: { time: string; durationMinutes: number }[]
): Date[] {
  const ids = Array.from({ length: interviewCount }, (_, i) => `__auto_${i}`);
  return computeBulkInterviewStartTimesWithCustom(
    dateStr,
    startTimeStr,
    durationMinutes,
    ids,
    breaks,
    {}
  );
}
