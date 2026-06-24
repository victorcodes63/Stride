/**
 * Rota conflict rules: minimum rest between shifts and maximum hours per week.
 * `resolveRotaPolicy` is the extension point for per–job-title / per–role overrides later.
 */

export type RotaPolicy = {
  /** Minimum gap between end of one shift and start of the next (ms). */
  minRestMs: number;
  /** Maximum net work hours (duration minus break) per ISO week (ms). */
  maxWeekWorkMs: number;
};

export const DEFAULT_ROTA_POLICY: RotaPolicy = {
  minRestMs: 8 * 60 * 60 * 1000,
  maxWeekWorkMs: 60 * 60 * 60 * 1000,
};

export type RotaPolicyContext = {
  /** Internal staff type (for future policy overrides). */
  staffUserType?: string;
  /** Outsourcing employee job title (for future policy overrides). */
  employeeJobTitle?: string | null;
};

/**
 * Central place to branch on role / job title. Today returns defaults; later can map
 * e.g. security / medical / driver to different rest or weekly caps.
 */
export function resolveRotaPolicy(_ctx: RotaPolicyContext = {}): RotaPolicy {
  return DEFAULT_ROTA_POLICY;
}

export type ShiftWindow = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  breakMinutes: number;
};

function netWorkMs(s: ShiftWindow): number {
  const raw = s.endsAt.getTime() - s.startsAt.getTime();
  return Math.max(0, raw - s.breakMinutes * 60 * 1000);
}

/** Monday 00:00:00 local time of the ISO week containing `d`. */
export function startOfIsoWeekLocal(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const day = x.getDay();
  const toMonday = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + toMonday);
  return x;
}

export type RotaConflict = {
  type: 'insufficient_rest' | 'weekly_hours_cap';
  employeeId: string;
  message: string;
  assignmentIds: string[];
  details?: {
    restMs?: number;
    minRestMs?: number;
    weekStart?: string;
    weekWorkMs?: number;
    maxWeekWorkMs?: number;
  };
};

/**
 * Detect rest and weekly-hour violations for a single employee’s shifts.
 * Sorts by `startsAt` and uses `workDate`’s ISO week to bucket weekly totals (by assignment.start / primary work day).
 */
export function detectConflictsForEmployee(
  employeeId: string,
  shifts: ShiftWindow[],
  policy: RotaPolicy = resolveRotaPolicy(),
): RotaConflict[] {
  const out: RotaConflict[] = [];
  if (shifts.length === 0) return out;

  const sorted = [...shifts].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const restMs = cur.startsAt.getTime() - prev.endsAt.getTime();
    if (restMs < policy.minRestMs) {
      out.push({
        type: 'insufficient_rest',
        employeeId,
        message: `Less than ${policy.minRestMs / 3600000}h rest between consecutive shifts`,
        assignmentIds: [prev.id, cur.id],
        details: { restMs, minRestMs: policy.minRestMs },
      });
    }
  }

  const byWeek = new Map<string, { ms: number; ids: string[] }>();
  for (const s of sorted) {
    const wk = startOfIsoWeekLocal(s.startsAt);
    const key = `${wk.getFullYear()}-${String(wk.getMonth() + 1).padStart(2, '0')}-${String(wk.getDate()).padStart(2, '0')}`;
    const net = netWorkMs(s);
    const cur = byWeek.get(key) ?? { ms: 0, ids: [] };
    cur.ms += net;
    cur.ids.push(s.id);
    byWeek.set(key, cur);
  }

  for (const [weekStart, { ms, ids }] of byWeek) {
    if (ms > policy.maxWeekWorkMs) {
      out.push({
        type: 'weekly_hours_cap',
        employeeId,
        message: `More than ${policy.maxWeekWorkMs / 3600000}h net work in one week`,
        assignmentIds: ids,
        details: {
          weekStart,
          weekWorkMs: ms,
          maxWeekWorkMs: policy.maxWeekWorkMs,
        },
      });
    }
  }

  return out;
}

export function detectConflictsForRoster(
  byEmployee: Map<string, ShiftWindow[]>,
  policy: RotaPolicy = resolveRotaPolicy(),
): RotaConflict[] {
  const all: RotaConflict[] = [];
  for (const [employeeId, shifts] of byEmployee) {
    all.push(...detectConflictsForEmployee(employeeId, shifts, policy));
  }
  return all;
}
