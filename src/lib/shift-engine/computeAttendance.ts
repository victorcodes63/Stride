export type PunchSource = 'device' | 'manual' | 'csv_import';
export type PunchType = 'clock_in' | 'clock_out';

export interface EnginePunch {
  id?: string;
  employeeId: string;
  type: PunchType;
  timestamp: Date;
  source: PunchSource;
}

export interface EngineShiftAssignment {
  id?: string;
  employeeId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  shiftTemplateId?: string;
  isRestDay?: boolean;
  isPublicHoliday?: boolean;
}

export interface EngineOvertimeConfig {
  shiftMatchToleranceHours?: number;
  duplicatePunchWindowSeconds?: number;
  dailyRegularHours?: number;
  weeklyRegularHours?: number;
  weekdayOvertimeMultiplier?: number;
  restDayMultiplier?: number;
  publicHolidayMultiplier?: number;
}

export interface EngineAttendanceRecord {
  employeeId: string;
  shiftDate: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  totalHours: number | null;
  regularHours: number | null;
  overtimeHours: number | null;
  overtimeRateMultiplier: number;
  status: 'complete' | 'pending_review' | 'corrected';
  shiftAssignmentId?: string;
}

export interface AttendanceCorrectionLog {
  correctedAt: Date;
  correctedBy: string;
  reason: string;
  before: Pick<EngineAttendanceRecord, 'clockIn' | 'clockOut' | 'totalHours' | 'regularHours' | 'overtimeHours' | 'status'>;
  after: Pick<EngineAttendanceRecord, 'clockIn' | 'clockOut' | 'totalHours' | 'regularHours' | 'overtimeHours' | 'status'>;
}

export interface WeeklyOvertimeBreakdown {
  regularHours: number;
  weekdayOvertimeHours: number;
  restDayHours: number;
  publicHolidayHours: number;
}

const DEFAULT_CONFIG: Required<EngineOvertimeConfig> = {
  shiftMatchToleranceHours: 4,
  duplicatePunchWindowSeconds: 60,
  dailyRegularHours: 8,
  weeklyRegularHours: 52,
  weekdayOvertimeMultiplier: 1.5,
  restDayMultiplier: 2,
  publicHolidayMultiplier: 2,
};

export function computeAttendance(
  punches: EnginePunch[],
  assignments: EngineShiftAssignment[],
  config: EngineOvertimeConfig = {}
): EngineAttendanceRecord[] {
  const resolved = { ...DEFAULT_CONFIG, ...config };
  const records: EngineAttendanceRecord[] = [];
  const employees = new Set(assignments.map((a) => a.employeeId));

  for (const employeeId of employees) {
    const employeePunches = debounceDuplicatePunches(
      punches.filter((p) => p.employeeId === employeeId),
      resolved.duplicatePunchWindowSeconds
    );
    const employeeAssignments = [...assignments]
      .filter((a) => a.employeeId === employeeId)
      .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
    const matchedByShift = new Map<string, { clockIn: Date | null; clockOut: Date | null }>();
    for (const assignment of employeeAssignments) {
      matchedByShift.set(shiftKey(assignment), { clockIn: null, clockOut: null });
    }
    const sortedPunches = [...employeePunches].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    for (const punch of sortedPunches) {
      if (punch.type === 'clock_in') {
        const chosen = selectBestShiftForClockIn(punch, employeeAssignments, matchedByShift, resolved.shiftMatchToleranceHours);
        if (chosen) matchedByShift.get(shiftKey(chosen))!.clockIn = punch.timestamp;
        continue;
      }
      const chosen = selectBestShiftForClockOut(punch, employeeAssignments, matchedByShift, resolved.shiftMatchToleranceHours);
      if (chosen) matchedByShift.get(shiftKey(chosen))!.clockOut = punch.timestamp;
    }

    for (const assignment of employeeAssignments) {
      const matched = matchedByShift.get(shiftKey(assignment)) ?? { clockIn: null, clockOut: null };
      const record = createRecordFromMatch(assignment, matched, resolved);
      records.push(record);
    }
  }

  return records.sort((a, b) => a.shiftDate.getTime() - b.shiftDate.getTime());
}

export function applyAttendanceCorrection(
  record: EngineAttendanceRecord,
  patch: Partial<Pick<EngineAttendanceRecord, 'clockIn' | 'clockOut'>>,
  correctedBy: string,
  reason: string,
  correctedAt = new Date()
): { corrected: EngineAttendanceRecord; log: AttendanceCorrectionLog } {
  const before = pickAuditValues(record);
  const corrected: EngineAttendanceRecord = {
    ...record,
    ...patch,
    status: 'corrected',
  };
  recomputeHours(corrected, DEFAULT_CONFIG);

  return {
    corrected,
    log: {
      correctedAt,
      correctedBy,
      reason,
      before,
      after: pickAuditValues(corrected),
    },
  };
}

export function computeWeeklyOvertimeBreakdown(
  dayHours: Array<{ date: Date; hours: number; isRestDay?: boolean; isPublicHoliday?: boolean }>,
  config: EngineOvertimeConfig = {}
): WeeklyOvertimeBreakdown {
  const resolved = { ...DEFAULT_CONFIG, ...config };
  let totalHours = 0;
  let restDayHours = 0;
  let publicHolidayHours = 0;
  for (const day of dayHours) {
    const hours = Math.max(0, day.hours);
    totalHours += hours;
    if (day.isPublicHoliday) {
      publicHolidayHours += hours;
    }
    if (day.isRestDay) {
      restDayHours += hours;
    }
  }
  const regularHours = Math.min(totalHours, resolved.weeklyRegularHours);
  const weekdayOvertimeHours = Math.max(0, totalHours - resolved.weeklyRegularHours);

  return {
    regularHours: round2(regularHours),
    weekdayOvertimeHours: round2(weekdayOvertimeHours),
    restDayHours: round2(restDayHours),
    publicHolidayHours: round2(publicHolidayHours),
  };
}

function inShiftWindow(at: Date, assignment: EngineShiftAssignment, toleranceHours: number): boolean {
  const toleranceMs = toleranceHours * 60 * 60 * 1000;
  const windowStart = assignment.scheduledStart.getTime() - toleranceMs;
  const windowEnd = assignment.scheduledEnd.getTime() + toleranceMs;
  const t = at.getTime();
  return t >= windowStart && t <= windowEnd;
}

function selectBestShiftForClockIn(
  punch: EnginePunch,
  assignments: EngineShiftAssignment[],
  matchedByShift: Map<string, { clockIn: Date | null; clockOut: Date | null }>,
  toleranceHours: number
): EngineShiftAssignment | null {
  const candidates = assignments
    .filter((a) => inShiftWindow(punch.timestamp, a, toleranceHours))
    .filter((a) => matchedByShift.get(shiftKey(a))?.clockIn == null);
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => {
    const da = Math.abs(punch.timestamp.getTime() - a.scheduledStart.getTime());
    const db = Math.abs(punch.timestamp.getTime() - b.scheduledStart.getTime());
    return da - db;
  })[0];
}

function selectBestShiftForClockOut(
  punch: EnginePunch,
  assignments: EngineShiftAssignment[],
  matchedByShift: Map<string, { clockIn: Date | null; clockOut: Date | null }>,
  toleranceHours: number
): EngineShiftAssignment | null {
  const candidates = assignments
    .filter((a) => inShiftWindow(punch.timestamp, a, toleranceHours))
    .filter((a) => {
      const current = matchedByShift.get(shiftKey(a));
      return (
        Boolean(current?.clockIn) &&
        current?.clockOut == null &&
        punch.timestamp.getTime() >= (current?.clockIn?.getTime() ?? 0)
      );
    });
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => {
    const da = Math.abs(punch.timestamp.getTime() - a.scheduledEnd.getTime());
    const db = Math.abs(punch.timestamp.getTime() - b.scheduledEnd.getTime());
    return da - db;
  })[0];
}

function createRecordFromMatch(
  assignment: EngineShiftAssignment,
  matched: { clockIn: Date | null; clockOut: Date | null },
  config: Required<EngineOvertimeConfig>
): EngineAttendanceRecord {
  const record: EngineAttendanceRecord = {
    employeeId: assignment.employeeId,
    shiftDate: startOfDayUtc(assignment.scheduledStart),
    clockIn: matched.clockIn,
    clockOut: matched.clockOut,
    totalHours: null,
    regularHours: null,
    overtimeHours: null,
    overtimeRateMultiplier: assignment.isPublicHoliday
      ? config.publicHolidayMultiplier
      : assignment.isRestDay
        ? config.restDayMultiplier
        : config.weekdayOvertimeMultiplier,
    status: matched.clockIn && matched.clockOut ? 'complete' : 'pending_review',
    shiftAssignmentId: assignment.id,
  };
  recomputeHours(record, config, assignment);
  return record;
}

function recomputeHours(
  record: EngineAttendanceRecord,
  config: Required<EngineOvertimeConfig>,
  assignment?: EngineShiftAssignment
): void {
  if (!record.clockIn || !record.clockOut) {
    record.totalHours = null;
    record.regularHours = null;
    record.overtimeHours = null;
    return;
  }
  const total = Math.max(0, (record.clockOut.getTime() - record.clockIn.getTime()) / 3_600_000);
  if (assignment?.isRestDay || assignment?.isPublicHoliday) {
    record.totalHours = round2(total);
    record.regularHours = 0;
    record.overtimeHours = round2(total);
    return;
  }
  const regular = Math.min(total, config.dailyRegularHours);
  const overtime = Math.max(0, total - config.dailyRegularHours);
  record.totalHours = round2(total);
  record.regularHours = round2(regular);
  record.overtimeHours = round2(overtime);
}

function debounceDuplicatePunches(punches: EnginePunch[], duplicateWindowSeconds: number): EnginePunch[] {
  if (punches.length < 2) return [...punches];
  const sorted = [...punches].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const result: EnginePunch[] = [];
  const windowMs = duplicateWindowSeconds * 1000;
  for (const punch of sorted) {
    const previous = result[result.length - 1];
    if (!previous) {
      result.push(punch);
      continue;
    }
    const delta = punch.timestamp.getTime() - previous.timestamp.getTime();
    if (punch.type === previous.type && delta <= windowMs) continue;
    result.push(punch);
  }
  return result;
}

function pickAuditValues(record: EngineAttendanceRecord) {
  return {
    clockIn: record.clockIn,
    clockOut: record.clockOut,
    totalHours: record.totalHours,
    regularHours: record.regularHours,
    overtimeHours: record.overtimeHours,
    status: record.status,
  };
}

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function shiftKey(assignment: EngineShiftAssignment): string {
  return assignment.id ?? `${assignment.employeeId}:${assignment.scheduledStart.toISOString()}:${assignment.scheduledEnd.toISOString()}`;
}
