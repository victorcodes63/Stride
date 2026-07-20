import type { StaffAssignment, StaffSubject } from './types';

export const TIMELINE_DAY_WIDTH = 200;

export function fmtMinutes(m: number): string {
  const hour = Math.floor(m / 60) % 24;
  const minute = m % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Local YYYY-MM-DD for an ISO/date-like string (avoids UTC off-by-one). */
export function toYmd(dateIsoLike: string): string {
  const d = new Date(dateIsoLike);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfWeek(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function hoursBetween(startIso: string, endIso: string, breakMinutes = 0): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime() - breakMinutes * 60 * 1000;
  return Math.max(0, ms / (60 * 60 * 1000));
}

/** Compact "08:00–17:00" range in 24h. */
export function formatShiftRangeCompact(startIso: string, endIso: string): string {
  const o: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
  return `${new Date(startIso).toLocaleTimeString(undefined, o)}–${new Date(endIso).toLocaleTimeString(undefined, o)}`;
}

/** "HH:mm" of a local instant (for <input type=time>). */
export function localHm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Minutes-from-midnight of a local instant. */
export function localMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** ISO string for a local wall-clock time on a given day. */
export function isoForDayTime(ymd: string, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const d = new Date(`${ymd}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export function shortDate(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function subjectLabel(s: StaffSubject): string {
  return s.name || s.email;
}

/** Group subjects by department (stable order, "Unassigned" last). */
export function groupSubjectsByDepartment(subjects: StaffSubject[]): Array<{ department: string; members: StaffSubject[] }> {
  const map = new Map<string, StaffSubject[]>();
  for (const s of subjects) {
    const key = s.department?.trim() || 'Unassigned';
    const arr = map.get(key) ?? [];
    arr.push(s);
    map.set(key, arr);
  }
  const entries = [...map.entries()].sort((a, b) => {
    if (a[0] === 'Unassigned') return 1;
    if (b[0] === 'Unassigned') return -1;
    return a[0].localeCompare(b[0]);
  });
  return entries.map(([department, members]) => ({ department, members }));
}

export type TimelineBar = {
  assignment: StaffAssignment;
  dayIndex: number;
  startHourOffset: number;
  endHourOffset: number;
  lane: number;
};

/** Lane-pack a subject's shifts across the visible week for the timeline view. */
export function packSubjectBars(assignments: StaffAssignment[], weekDays: string[]): { bars: TimelineBar[]; laneCount: number } {
  const entries = assignments
    .map((a) => {
      const workYmd = toYmd(a.workDate);
      const dayIndex = weekDays.indexOf(workYmd);
      if (dayIndex < 0) return null;
      const dayStart = new Date(`${workYmd}T00:00:00`).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const start = new Date(a.startsAt).getTime();
      const end = new Date(a.endsAt).getTime();
      const clampedStart = Math.max(start, dayStart);
      const clampedEnd = Math.min(end, dayEnd);
      if (clampedEnd <= clampedStart) return null;
      return {
        assignment: a,
        dayIndex,
        startMs: clampedStart,
        endMs: clampedEnd,
        startHourOffset: (clampedStart - dayStart) / 3_600_000,
        endHourOffset: (clampedEnd - dayStart) / 3_600_000,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => a.startMs - b.startMs);

  const laneEnds: number[] = [];
  const bars: TimelineBar[] = entries.map((entry) => {
    let lane = laneEnds.findIndex((end) => end <= entry.startMs);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(entry.endMs);
    } else {
      laneEnds[lane] = entry.endMs;
    }
    return {
      assignment: entry.assignment,
      dayIndex: entry.dayIndex,
      startHourOffset: entry.startHourOffset,
      endHourOffset: entry.endHourOffset,
      lane,
    };
  });

  return { bars, laneCount: Math.max(1, laneEnds.length) };
}
