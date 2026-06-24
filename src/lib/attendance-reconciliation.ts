import type { PrismaClient } from '@prisma/client';
import {
  computeAttendance,
  type EnginePunch,
  type EngineShiftAssignment,
} from '@/lib/shift-engine/computeAttendance';
import { doesShiftTouchPublicHoliday } from '@/lib/holidays';
import {
  getEssPortalUserIdForEmployee,
  getManagerUserIdForEmployee,
  sendNotification,
} from '@/lib/notifications';

type ReconcileOptions = {
  employeeId: string;
  workDate: string; // YYYY-MM-DD
  actorUserId?: string | null;
};

/** Inputs for pure metrics (tests + shift engine path). */
export type ReconcileEventInput = {
  kind: string;
  observedAt: Date;
  source: string;
};

export type ReconcileShiftInput = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  breakMinutes: number;
};

const SHIFT_TOLERANCE_HOURS = 4;
const DUPLICATE_PUNCH_WINDOW_SECONDS = 60;
const TOLERANCE_MS = SHIFT_TOLERANCE_HOURS * 60 * 60 * 1000;

function toWorkDate(input: string): Date {
  return new Date(`${input}T00:00:00.000Z`);
}

function toYmdUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function scheduledWorkMinutes(shift: ReconcileShiftInput): number {
  return Math.max(
    0,
    Math.round((shift.endsAt.getTime() - shift.startsAt.getTime()) / 60000) - shift.breakMinutes
  );
}

function mapKindToPunchType(kind: string): 'clock_in' | 'clock_out' | null {
  if (kind === 'check_in') return 'clock_in';
  if (kind === 'check_out') return 'clock_out';
  return null;
}

function mapSourceToEngineSource(source: string): EnginePunch['source'] {
  if (source === 'manual') return 'manual';
  return 'device';
}

function eventsToEnginePunches(events: ReconcileEventInput[], employeeId: string): EnginePunch[] {
  const punches: EnginePunch[] = [];
  for (const e of events) {
    const type = mapKindToPunchType(String(e.kind));
    if (!type) continue;
    punches.push({
      employeeId,
      type,
      timestamp: e.observedAt,
      source: mapSourceToEngineSource(String(e.source)),
    });
  }
  return punches;
}

function shiftsToEngineAssignments(
  shiftRows: ReconcileShiftInput[],
  employeeId: string
): EngineShiftAssignment[] {
  return shiftRows.map((row) => ({
    id: row.id,
    employeeId,
    scheduledStart: row.startsAt,
    scheduledEnd: row.endsAt,
  }));
}

/**
 * Pure reconciliation metrics for days with shift assignments.
 * Uses `computeAttendance` for debounce, cross-midnight pairing, and multi-shift matching.
 * Overtime minutes follow production rules: worked minutes minus scheduled shift length (minus break), not engine daily buckets.
 */
export async function computeReconciledSummaryMetrics(
  events: ReconcileEventInput[],
  shiftRows: ReconcileShiftInput[],
  employeeId: string,
  holidayResolver: (clockIn: Date | null, clockOut: Date | null) => Promise<{ isHoliday: boolean; holidayName?: string }> = doesShiftTouchPublicHoliday
): Promise<{
  firstInAt: Date | null;
  lastOutAt: Date | null;
  minutesWorked: number;
  overtimeMinutes: number;
  holidayOvertimeMinutes: number;
  publicHolidayName: string | null;
  summaryStatus: 'draft' | 'reconciled';
}> {
  const punches = eventsToEnginePunches(events, employeeId);
  const engineAssignments = shiftsToEngineAssignments(shiftRows, employeeId);
  const records = computeAttendance(punches, engineAssignments, {
    shiftMatchToleranceHours: SHIFT_TOLERANCE_HOURS,
    duplicatePunchWindowSeconds: DUPLICATE_PUNCH_WINDOW_SECONDS,
  });

  let minutesWorked = 0;
  let overtimeMinutes = 0;
  let holidayOvertimeMinutes = 0;
  let publicHolidayName: string | null = null;
  let firstInAt: Date | null = null;
  let lastOutAt: Date | null = null;
  let anyPending = false;

  for (const r of records) {
    if (r.status === 'pending_review') anyPending = true;
    if (r.clockIn && (!firstInAt || r.clockIn.getTime() < firstInAt.getTime())) firstInAt = r.clockIn;
    if (r.clockOut && (!lastOutAt || r.clockOut.getTime() > lastOutAt.getTime())) lastOutAt = r.clockOut;

    const shift = shiftRows.find((s) => s.id === r.shiftAssignmentId);
    if (r.clockIn && r.clockOut && r.clockOut.getTime() > r.clockIn.getTime() && shift) {
      const segmentMinutes = Math.round((r.clockOut.getTime() - r.clockIn.getTime()) / 60000);
      minutesWorked += segmentMinutes;
      const scheduledMinutes = scheduledWorkMinutes(shift);
      const holidayCheck = await holidayResolver(r.clockIn, r.clockOut);
      if (holidayCheck.isHoliday) {
        holidayOvertimeMinutes += segmentMinutes;
        overtimeMinutes += segmentMinutes;
        if (!publicHolidayName && holidayCheck.holidayName) {
          publicHolidayName = holidayCheck.holidayName;
        }
      } else {
        overtimeMinutes += Math.max(0, segmentMinutes - scheduledMinutes);
      }
    }
  }

  const complete = Boolean(firstInAt && lastOutAt && lastOutAt.getTime() > firstInAt.getTime());
  const summaryStatus =
    events.length === 0 ? 'draft' : anyPending || !complete ? 'draft' : 'reconciled';

  return {
    firstInAt,
    lastOutAt,
    minutesWorked,
    overtimeMinutes,
    holidayOvertimeMinutes,
    publicHolidayName,
    summaryStatus,
  };
}

function legacyFirstLastMetrics(events: ReconcileEventInput[]): {
  firstInAt: Date | null;
  lastOutAt: Date | null;
  minutesWorked: number;
  overtimeMinutes: number;
  summaryStatus: 'draft' | 'reconciled';
} {
  const firstIn = events.find((e) => e.kind === 'check_in');
  const lastOut = [...events].reverse().find((e) => e.kind === 'check_out');
  let minutesWorked = 0;
  if (firstIn && lastOut && lastOut.observedAt.getTime() > firstIn.observedAt.getTime()) {
    minutesWorked = Math.round((lastOut.observedAt.getTime() - firstIn.observedAt.getTime()) / 60000);
  }
  const complete = Boolean(
    firstIn && lastOut && lastOut.observedAt.getTime() > firstIn.observedAt.getTime()
  );
  return {
    firstInAt: firstIn?.observedAt ?? null,
    lastOutAt: lastOut?.observedAt ?? null,
    minutesWorked,
    overtimeMinutes: 0,
    summaryStatus: events.length === 0 ? 'draft' : !complete ? 'draft' : 'reconciled',
  };
}

export async function resolveReconcileWorkDatesForObservedAt(
  db: PrismaClient,
  employeeId: string,
  observedAt: Date
): Promise<string[]> {
  const base = toYmdUtc(observedAt);
  const dates = new Set<string>([base]);
  const candidateAssignments = await db.shiftAssignment.findMany({
    where: {
      employeeId,
      startsAt: { lte: new Date(observedAt.getTime() + TOLERANCE_MS) },
      endsAt: { gte: new Date(observedAt.getTime() - TOLERANCE_MS) },
    },
    select: { workDate: true },
    take: 5,
    orderBy: { startsAt: 'desc' },
  });
  for (const item of candidateAssignments) {
    dates.add(toYmdUtc(item.workDate));
  }
  return [...dates];
}

export async function reconcileAttendanceDay(db: PrismaClient, options: ReconcileOptions) {
  const workDate = toWorkDate(options.workDate);

  const employee = await db.employee.findUnique({
    where: { id: options.employeeId },
    select: { id: true, outsourcingClientId: true, attendancePolicyAssignments: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
  });
  if (!employee) throw new Error('Employee not found');

  const assignments = await db.shiftAssignment.findMany({
    where: {
      employeeId: options.employeeId,
      workDate,
    },
    orderBy: { startsAt: 'asc' },
  });

  let rangeStart = workDate;
  let rangeEnd = new Date(workDate.getTime() + 24 * 60 * 60 * 1000);
  if (assignments.length > 0) {
    rangeStart = new Date(
      Math.min(...assignments.map((a) => a.startsAt.getTime() - TOLERANCE_MS))
    );
    rangeEnd = new Date(Math.max(...assignments.map((a) => a.endsAt.getTime() + TOLERANCE_MS)));
  }

  const events = await db.attendanceEvent.findMany({
    where: {
      employeeId: options.employeeId,
      observedAt: { gte: rangeStart, lt: rangeEnd },
    },
    orderBy: { observedAt: 'asc' },
  });

  const shiftInputs: ReconcileShiftInput[] = assignments.map((a) => ({
    id: a.id,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    breakMinutes: a.breakMinutes,
  }));

  let firstInAt: Date | null;
  let lastOutAt: Date | null;
  let minutesWorked: number;
  let overtimeMinutes: number;
  let holidayOvertimeMinutes = 0;
  let publicHolidayName: string | null = null;
  let summaryStatus: 'draft' | 'reconciled';

  if (assignments.length > 0) {
    const m = await computeReconciledSummaryMetrics(events, shiftInputs, options.employeeId);
    firstInAt = m.firstInAt;
    lastOutAt = m.lastOutAt;
    minutesWorked = m.minutesWorked;
    overtimeMinutes = m.overtimeMinutes;
    holidayOvertimeMinutes = m.holidayOvertimeMinutes;
    publicHolidayName = m.publicHolidayName;
    summaryStatus = m.summaryStatus;
  } else {
    const legacy = legacyFirstLastMetrics(events);
    firstInAt = legacy.firstInAt;
    lastOutAt = legacy.lastOutAt;
    minutesWorked = legacy.minutesWorked;
    overtimeMinutes = legacy.overtimeMinutes;
    holidayOvertimeMinutes = 0;
    publicHolidayName = null;
    summaryStatus = legacy.summaryStatus;
  }

  const attendancePolicyId = employee.attendancePolicyAssignments[0]?.attendancePolicyId ?? null;
  const summary = await db.attendanceDaySummary.upsert({
    where: { employeeId_workDate: { employeeId: options.employeeId, workDate } },
    create: {
      employeeId: options.employeeId,
      outsourcingClientId: employee.outsourcingClientId,
      workDate,
      attendancePolicyId,
      firstInAt,
      lastOutAt,
      minutesWorked,
      overtimeMinutes,
      holidayOvertimeMinutes,
      publicHolidayName,
      status: summaryStatus,
      sourceBreakdown: {
        biometric: events.filter((e) => e.source === 'biometric').length,
        manual: events.filter((e) => e.source === 'manual').length,
        rota: events.filter((e) => e.source === 'rota').length,
      },
    },
    update: {
      attendancePolicyId,
      firstInAt,
      lastOutAt,
      minutesWorked,
      overtimeMinutes,
      holidayOvertimeMinutes,
      publicHolidayName,
      status: summaryStatus,
      sourceBreakdown: {
        biometric: events.filter((e) => e.source === 'biometric').length,
        manual: events.filter((e) => e.source === 'manual').length,
        rota: events.filter((e) => e.source === 'rota').length,
      },
    },
  });

  await db.attendanceException.deleteMany({
    where: { employeeId: options.employeeId, workDate, status: 'open' },
  });

  const exceptionRows: Array<{ type: 'missing_check_in' | 'missing_check_out'; description: string }> = [];
  if (!firstInAt) exceptionRows.push({ type: 'missing_check_in', description: 'No check-in event found for this shift/day window.' });
  if (!lastOutAt) exceptionRows.push({ type: 'missing_check_out', description: 'No check-out event found for this shift/day window.' });

  if (exceptionRows.length > 0) {
    await db.attendanceException.createMany({
      data: exceptionRows.map((item) => ({
        employeeId: options.employeeId,
        attendanceDaySummaryId: summary.id,
        workDate,
        type: item.type,
        description: item.description,
      })),
    });
    try {
      const missingClockOut = exceptionRows.some((item) => item.type === 'missing_check_out');
      if (missingClockOut) {
        const employee = await db.employee.findUnique({
          where: { id: options.employeeId },
          select: { firstName: true, lastName: true },
        });
        const managerEssId = await getManagerUserIdForEmployee(options.employeeId);
        const employeeEssId = await getEssPortalUserIdForEmployee(options.employeeId);
        await sendNotification({
          event: 'missing_clock_out',
          recipientEssPortalUserIds: [
            ...(managerEssId ? [managerEssId] : []),
            ...(employeeEssId ? [employeeEssId] : []),
          ],
          title: 'Missing clock-out',
          body: `${employee ? `${employee.firstName} ${employee.lastName}` : 'Employee'} has no clock-out recorded for ${options.workDate}. Please review.`,
          href: '/dashboard/outsourcing/attendance',
          priority: 'action_required',
          channel: 'in_app',
          metadata: { employeeId: options.employeeId, workDate: options.workDate },
        });
      }
    } catch (err) {
      console.error('[notifications] Failed to send missing_clock_out:', err);
    }
  }

  return summary;
}

/** Payroll and payslip views should only sum overtime from finalized day rows. */
export const ATTENDANCE_SUMMARY_STATUSES_FOR_PAYROLL: Array<'reconciled' | 'approved'> = [
  'reconciled',
  'approved',
];
