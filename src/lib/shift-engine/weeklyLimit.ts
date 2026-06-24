import type { ISODateTimeString } from './types';

export interface WorkSegment {
  employeeId: string;
  start: ISODateTimeString;
  end: ISODateTimeString | null;
}

/**
 * R7a: Work minutes inside the ISO-8601 week (Monday 00:00 UTC → next Monday 00:00 UTC)
 * that contains `refInstant`, for one employee, summing over segments (half-open intersection).
 */
export function weeklyWorkedMinutesIsoWeek(
  employeeId: string,
  refIso: ISODateTimeString,
  segments: WorkSegment[]
): number {
  const { startMs, endMs } = isoWeekUtcRangeContaining(new Date(refIso));
  let sum = 0;
  for (const s of segments) {
    if (s.employeeId !== employeeId || s.end == null) continue;
    const a = new Date(s.start).getTime();
    const b = new Date(s.end).getTime();
    const overlap = Math.max(0, Math.min(b, endMs) - Math.max(a, startMs));
    sum += Math.floor(overlap / 60_000);
  }
  return sum;
}

/** R7b: Positive part of (workedTotalMinutes − capMinutes). */
export function weeklyExcessOverCapMinutes(workedTotalMinutes: number, capMinutes: number): number {
  return Math.max(0, workedTotalMinutes - capMinutes);
}

function isoWeekUtcRangeContaining(d: Date): { startMs: number; endMs: number } {
  // Monday 00:00 UTC of the week containing d (ISO week, Monday = first day)
  const day = d.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  const start = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - mondayOffset,
    0,
    0,
    0,
    0
  );
  const end = start + 7 * 24 * 60 * 60 * 1000;
  return { startMs: start, endMs: end };
}
