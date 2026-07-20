import { instantsFromTemplateMinutes, dateKeyLocal } from '@/lib/rota/shift-instants';
import {
  detectConflictsForUser,
  type ShiftWindow,
  type StaffRotaConflict,
  type StaffRotaPolicy,
} from '@/lib/staff-rota/policy-engine';

export { instantsFromTemplateMinutes, dateKeyLocal };

type AssignmentLike = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  breakMinutes: number;
};

export function toShiftWindows(rows: AssignmentLike[]): ShiftWindow[] {
  return rows.map((r) => ({
    id: r.id,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    breakMinutes: r.breakMinutes,
  }));
}

/** Parse "HH:mm" to minutes-from-midnight, or null when malformed. */
export function parseHmToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Detect the conflicts a proposed shift would introduce for one user. */
export function conflictsForProposed(
  existing: AssignmentLike[],
  proposed: Pick<AssignmentLike, 'id' | 'startsAt' | 'endsAt' | 'breakMinutes'>,
  userId: string,
  policy: StaffRotaPolicy,
): StaffRotaConflict[] {
  return detectConflictsForUser(userId, toShiftWindows([...existing, proposed]), policy);
}

/** Ensure a YYYY-MM-DD work date falls within the rota period (inclusive). */
export function assertWorkDateInRota(workDate: string, rotaStart: Date, rotaEnd: Date) {
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(workDate);
  if (!p) {
    throw new Error('workDate must fall within the rota period (inclusive)');
  }
  const y = parseInt(p[1]!, 10);
  const m = parseInt(p[2]!, 10);
  const day = parseInt(p[3]!, 10);
  const wd = new Date(y, m - 1, day);
  const s = new Date(rotaStart.getFullYear(), rotaStart.getMonth(), rotaStart.getDate());
  const e = new Date(rotaEnd.getFullYear(), rotaEnd.getMonth(), rotaEnd.getDate());
  if (wd < s || wd > e) {
    throw new Error('workDate must fall within the rota period (inclusive)');
  }
}

/**
 * Resolve shift instants from any of the accepted assignment payload shapes.
 * Priority: template → startMinutes/endMinutes → startTime/endTime → ISO.
 * Returns `{ startsAt, endsAt, templateId, breakMinutes }` or an `error`.
 */
export function resolveShiftInstants(input: {
  workDate: string;
  template?: { id: string; startMinutes: number; endMinutes: number; breakMinutes: number } | null;
  startMinutes?: number;
  endMinutes?: number;
  startTime?: string | null;
  endTime?: string | null;
  startsAtIso?: string | null;
  endsAtIso?: string | null;
  breakMinutes: number;
  breakProvided: boolean;
}):
  | { error: string }
  | { startsAt: Date; endsAt: Date; templateId: string | null; breakMinutes: number } {
  const { workDate } = input;
  let breakMinutes = input.breakMinutes;

  try {
    if (input.template) {
      const inst = instantsFromTemplateMinutes(
        workDate,
        input.template.startMinutes,
        input.template.endMinutes,
      );
      if (!input.breakProvided && input.template.breakMinutes) {
        breakMinutes = input.template.breakMinutes;
      }
      return { ...inst, templateId: input.template.id, breakMinutes };
    }
    if (Number.isFinite(input.startMinutes) && Number.isFinite(input.endMinutes)) {
      const inst = instantsFromTemplateMinutes(workDate, input.startMinutes!, input.endMinutes!);
      return { ...inst, templateId: null, breakMinutes };
    }
    const tStart = input.startTime != null ? parseHmToMinutes(input.startTime) : null;
    const tEnd = input.endTime != null ? parseHmToMinutes(input.endTime) : null;
    if (tStart != null && tEnd != null) {
      const inst = instantsFromTemplateMinutes(workDate, tStart, tEnd);
      return { ...inst, templateId: null, breakMinutes };
    }
    if (input.startsAtIso && input.endsAtIso) {
      const startsAt = new Date(input.startsAtIso);
      const endsAt = new Date(input.endsAtIso);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        return { error: 'startsAt/endsAt are not valid ISO datetimes' };
      }
      if (endsAt.getTime() <= startsAt.getTime()) {
        return { error: 'endsAt must be after startsAt' };
      }
      return { startsAt, endsAt, templateId: null, breakMinutes };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid shift times' };
  }

  return {
    error:
      'Provide shiftTemplateId, or startMinutes+endMinutes, or startTime+endTime (HH:mm), or startsAt+endsAt (ISO)',
  };
}
