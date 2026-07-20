/**
 * Tenant-own rota policy engine.
 *
 * This is a real, per-role policy engine (replacing the outsourcing
 * `resolveRotaPolicy` stub which always returned defaults). It resolves a
 * concrete rule-set from the staff member's persona (`StaffUserType`) and
 * department, and detects a rich set of scheduling conflicts.
 *
 * Rules are intentionally data-driven so future overrides (e.g. a per-org
 * `StaffRotaPolicy` model) can slot in without touching call-sites.
 */

const HOUR_MS = 60 * 60 * 1000;

export type StaffRotaPolicy = {
  /** Stable identifier for the resolved policy (persona or 'default'). */
  key: string;
  /** Human-readable label for UI surfaces. */
  label: string;
  /** Minimum gap between the end of one shift and the start of the next (ms). */
  minRestMs: number;
  /** Maximum net work (duration − break) per ISO week (ms). */
  maxWeekWorkMs: number;
  /** Maximum length of a single shift (ms). */
  maxShiftMs: number;
  /** Maximum number of consecutive worked days before a rest day is required. */
  maxConsecutiveDays: number;
  /** Whether two shifts for the same person may overlap in time. */
  allowOverlap: boolean;
};

export type StaffRotaPolicyContext = {
  staffUserType?: string | null;
  department?: string | null;
};

/** Baseline rule-set applied when no persona-specific override matches. */
export const DEFAULT_STAFF_ROTA_POLICY: StaffRotaPolicy = {
  key: 'default',
  label: 'Standard staff',
  minRestMs: 11 * HOUR_MS,
  maxWeekWorkMs: 48 * HOUR_MS,
  maxShiftMs: 12 * HOUR_MS,
  maxConsecutiveDays: 6,
  allowOverlap: false,
};

/**
 * Persona-specific overrides. Each persona inherits the default and only
 * declares what differs, keeping the intent obvious.
 */
const PERSONA_OVERRIDES: Record<string, Partial<StaffRotaPolicy> & { label: string }> = {
  operations: {
    label: 'Operations & field',
    minRestMs: 10 * HOUR_MS,
    maxWeekWorkMs: 52 * HOUR_MS,
    maxShiftMs: 13 * HOUR_MS,
    maxConsecutiveDays: 7,
  },
  business_manager: {
    label: 'Business manager',
    minRestMs: 8 * HOUR_MS,
    maxWeekWorkMs: 55 * HOUR_MS,
  },
  director: {
    label: 'Director',
    minRestMs: 8 * HOUR_MS,
    maxWeekWorkMs: 60 * HOUR_MS,
    maxShiftMs: 14 * HOUR_MS,
  },
  finance: {
    label: 'Finance & accounts',
    maxWeekWorkMs: 45 * HOUR_MS,
  },
  sales_rep: {
    label: 'Sales rep',
    maxWeekWorkMs: 50 * HOUR_MS,
  },
  sales_manager: {
    label: 'Sales manager',
    maxWeekWorkMs: 52 * HOUR_MS,
  },
};

export function resolveStaffRotaPolicy(ctx: StaffRotaPolicyContext = {}): StaffRotaPolicy {
  const persona = ctx.staffUserType ? PERSONA_OVERRIDES[ctx.staffUserType] : undefined;
  if (!persona) return DEFAULT_STAFF_ROTA_POLICY;
  return {
    ...DEFAULT_STAFF_ROTA_POLICY,
    ...persona,
    key: ctx.staffUserType ?? 'default',
  };
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

export type ShiftWindow = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  breakMinutes: number;
};

export type StaffRotaConflictType =
  | 'overlap'
  | 'insufficient_rest'
  | 'max_shift_length'
  | 'weekly_hours_cap'
  | 'max_consecutive_days'
  | 'coverage_understaffed';

export type StaffRotaConflictSeverity = 'error' | 'warning';

export type StaffRotaConflict = {
  type: StaffRotaConflictType;
  severity: StaffRotaConflictSeverity;
  /** Subject user, or null for roster-wide (coverage) findings. */
  userId: string | null;
  message: string;
  assignmentIds: string[];
  details?: Record<string, unknown>;
};

/** Conflict types that must block a write (return 409). Others are advisory. */
export const BLOCKING_CONFLICT_TYPES: ReadonlySet<StaffRotaConflictType> = new Set<StaffRotaConflictType>([
  'overlap',
  'insufficient_rest',
  'max_shift_length',
  'weekly_hours_cap',
]);

export function isBlockingConflict(c: StaffRotaConflict): boolean {
  return BLOCKING_CONFLICT_TYPES.has(c.type);
}

function netWorkMs(s: ShiftWindow): number {
  const raw = s.endsAt.getTime() - s.startsAt.getTime();
  return Math.max(0, raw - s.breakMinutes * 60 * 1000);
}

/** Monday 00:00 local time of the ISO week containing `d`. */
export function startOfIsoWeekLocal(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const day = x.getDay();
  const toMonday = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + toMonday);
  return x;
}

function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtHours(ms: number): string {
  return (ms / HOUR_MS).toFixed(ms % HOUR_MS === 0 ? 0 : 1);
}

/**
 * Detect all per-person conflicts for one staff member's set of shifts.
 * Shifts do not need to be pre-sorted.
 */
export function detectConflictsForUser(
  userId: string,
  shifts: ShiftWindow[],
  policy: StaffRotaPolicy = DEFAULT_STAFF_ROTA_POLICY,
): StaffRotaConflict[] {
  const out: StaffRotaConflict[] = [];
  if (shifts.length === 0) return out;

  const sorted = [...shifts].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  // Single-shift rules + pairwise rest/overlap.
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const durationMs = cur.endsAt.getTime() - cur.startsAt.getTime();
    if (durationMs > policy.maxShiftMs) {
      out.push({
        type: 'max_shift_length',
        severity: 'error',
        userId,
        message: `Shift longer than ${fmtHours(policy.maxShiftMs)}h (${fmtHours(durationMs)}h)`,
        assignmentIds: [cur.id],
        details: { durationMs, maxShiftMs: policy.maxShiftMs },
      });
    }

    if (i === 0) continue;
    const prev = sorted[i - 1]!;

    if (!policy.allowOverlap && cur.startsAt.getTime() < prev.endsAt.getTime()) {
      out.push({
        type: 'overlap',
        severity: 'error',
        userId,
        message: 'Overlapping shifts for the same person',
        assignmentIds: [prev.id, cur.id],
      });
      continue;
    }

    const restMs = cur.startsAt.getTime() - prev.endsAt.getTime();
    if (restMs >= 0 && restMs < policy.minRestMs) {
      out.push({
        type: 'insufficient_rest',
        severity: 'error',
        userId,
        message: `Less than ${fmtHours(policy.minRestMs)}h rest between shifts (${fmtHours(restMs)}h)`,
        assignmentIds: [prev.id, cur.id],
        details: { restMs, minRestMs: policy.minRestMs },
      });
    }
  }

  // Weekly net-hours cap (bucketed by ISO week of shift start).
  const byWeek = new Map<string, { ms: number; ids: string[] }>();
  for (const s of sorted) {
    const key = dayKeyLocal(startOfIsoWeekLocal(s.startsAt));
    const cur = byWeek.get(key) ?? { ms: 0, ids: [] };
    cur.ms += netWorkMs(s);
    cur.ids.push(s.id);
    byWeek.set(key, cur);
  }
  for (const [weekStart, { ms, ids }] of byWeek) {
    if (ms > policy.maxWeekWorkMs) {
      out.push({
        type: 'weekly_hours_cap',
        severity: 'error',
        userId,
        message: `${fmtHours(ms)}h net work in the week of ${weekStart} exceeds the ${fmtHours(policy.maxWeekWorkMs)}h cap`,
        assignmentIds: ids,
        details: { weekStart, weekWorkMs: ms, maxWeekWorkMs: policy.maxWeekWorkMs },
      });
    }
  }

  // Consecutive worked days (advisory).
  const workedDays = [...new Set(sorted.map((s) => dayKeyLocal(s.startsAt)))].sort();
  let runStart = 0;
  for (let i = 1; i <= workedDays.length; i++) {
    const isBreak =
      i === workedDays.length ||
      !isNextDay(workedDays[i - 1]!, workedDays[i]!);
    if (isBreak) {
      const runLen = i - runStart;
      if (runLen > policy.maxConsecutiveDays) {
        const runDays = new Set(workedDays.slice(runStart, i));
        out.push({
          type: 'max_consecutive_days',
          severity: 'warning',
          userId,
          message: `${runLen} consecutive worked days exceeds the ${policy.maxConsecutiveDays}-day limit`,
          assignmentIds: sorted.filter((s) => runDays.has(dayKeyLocal(s.startsAt))).map((s) => s.id),
          details: { runLength: runLen, maxConsecutiveDays: policy.maxConsecutiveDays },
        });
      }
      runStart = i;
    }
  }

  return out;
}

function isNextDay(a: string, b: string): boolean {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return db.getTime() - da.getTime() === 24 * HOUR_MS;
}

/**
 * Coverage scan: flag calendar days (within [from, to]) that have fewer than
 * `minStaffPerDay` distinct staff scheduled. Advisory only.
 */
export function detectCoverageGaps(
  dayKeys: string[],
  assignmentsByDay: Map<string, { userIds: Set<string>; assignmentIds: string[] }>,
  minStaffPerDay: number,
): StaffRotaConflict[] {
  if (minStaffPerDay <= 0) return [];
  const out: StaffRotaConflict[] = [];
  for (const day of dayKeys) {
    const entry = assignmentsByDay.get(day);
    const staffed = entry?.userIds.size ?? 0;
    if (staffed < minStaffPerDay) {
      out.push({
        type: 'coverage_understaffed',
        severity: 'warning',
        userId: null,
        message: `${day} has ${staffed} staff scheduled (target ${minStaffPerDay})`,
        assignmentIds: entry?.assignmentIds ?? [],
        details: { day, staffed, minStaffPerDay },
      });
    }
  }
  return out;
}
