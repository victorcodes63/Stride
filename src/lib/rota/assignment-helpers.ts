import { detectConflictsForEmployee, type RotaPolicy, type ShiftWindow } from '@/lib/rota/conflict-rules';

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

export function conflictsForProposed(
  existing: AssignmentLike[],
  proposed: Pick<AssignmentLike, 'id' | 'startsAt' | 'endsAt' | 'breakMinutes'>,
  employeeId: string,
  policy: RotaPolicy,
) {
  return detectConflictsForEmployee(employeeId, toShiftWindows([...existing, proposed]), policy);
}

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
