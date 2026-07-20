import type { PrismaClient, Prisma } from '@prisma/client';
import {
  computeReconciledSummaryMetrics,
  type ReconcileEventInput,
  type ReconcileShiftInput,
} from '@/lib/attendance-reconciliation';
import { createHolidayResolver } from '@/lib/holidays';

/**
 * Internal-staff (tenant-own) attendance reconciliation.
 *
 * Mirrors `@/lib/attendance-reconciliation` (which is keyed on Employee +
 * OutsourcingClient) but operates on the Staff* models keyed on internal staff
 * Users and scoped to the tenant organization. Both the Attendance and the
 * Biometric modules call `reconcileStaffAttendanceDay` after writing events.
 *
 * The heavy pure metric computation is reused from the outsourcing engine via
 * `computeReconciledSummaryMetrics`, which is subject-agnostic.
 */

const SHIFT_TOLERANCE_HOURS = 4;
const TOLERANCE_MS = SHIFT_TOLERANCE_HOURS * 60 * 60 * 1000;

type StaffReconcileOptions = {
  userId: string;
  workDate: string; // YYYY-MM-DD
  actorUserId?: string | null;
};

type StaffDb = PrismaClient | Prisma.TransactionClient;

function toWorkDate(input: string): Date {
  return new Date(`${input}T00:00:00.000Z`);
}

function toYmdUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
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
    firstIn && lastOut && lastOut.observedAt.getTime() > firstIn.observedAt.getTime(),
  );
  return {
    firstInAt: firstIn?.observedAt ?? null,
    lastOutAt: lastOut?.observedAt ?? null,
    minutesWorked,
    overtimeMinutes: 0,
    summaryStatus: events.length === 0 ? 'draft' : !complete ? 'draft' : 'reconciled',
  };
}

/** Resolve which work-dates need re-reconciliation for a punch observed at `observedAt`. */
export async function resolveStaffReconcileWorkDatesForObservedAt(
  db: StaffDb,
  userId: string,
  observedAt: Date,
): Promise<string[]> {
  const base = toYmdUtc(observedAt);
  const dates = new Set<string>([base]);
  const candidates = await db.staffShiftAssignment.findMany({
    where: {
      userId,
      startsAt: { lte: new Date(observedAt.getTime() + TOLERANCE_MS) },
      endsAt: { gte: new Date(observedAt.getTime() - TOLERANCE_MS) },
    },
    select: { workDate: true },
    take: 5,
    orderBy: { startsAt: 'desc' },
  });
  for (const item of candidates) dates.add(toYmdUtc(item.workDate));
  return [...dates];
}

/**
 * Recompute one staff member's day summary from their attendance events + rota,
 * upserting `StaffAttendanceDaySummary` and refreshing open exceptions.
 * Requires `organizationId` so the row is tenant-scoped (RLS + explicit filter).
 */
export async function reconcileStaffAttendanceDay(
  db: StaffDb,
  organizationId: string,
  options: StaffReconcileOptions,
) {
  const workDate = toWorkDate(options.workDate);

  const policyAssignment = await db.staffAttendancePolicyAssignment.findFirst({
    where: { userId: options.userId },
    orderBy: { effectiveFrom: 'desc' },
    select: { staffAttendancePolicyId: true },
  });

  const policy = policyAssignment
    ? await db.staffAttendancePolicy.findUnique({
        where: { id: policyAssignment.staffAttendancePolicyId },
        select: { graceInMinutes: true },
      })
    : null;
  const graceInMinutes = policy?.graceInMinutes ?? 0;

  const assignments = await db.staffShiftAssignment.findMany({
    where: { userId: options.userId, workDate },
    orderBy: { startsAt: 'asc' },
  });

  let rangeStart = workDate;
  let rangeEnd = new Date(workDate.getTime() + 24 * 60 * 60 * 1000);
  if (assignments.length > 0) {
    rangeStart = new Date(Math.min(...assignments.map((a) => a.startsAt.getTime() - TOLERANCE_MS)));
    rangeEnd = new Date(Math.max(...assignments.map((a) => a.endsAt.getTime() + TOLERANCE_MS)));
  }

  const events = await db.staffAttendanceEvent.findMany({
    where: { userId: options.userId, observedAt: { gte: rangeStart, lt: rangeEnd } },
    orderBy: { observedAt: 'asc' },
  });

  const eventInputs: ReconcileEventInput[] = events.map((e) => ({
    kind: String(e.kind),
    observedAt: e.observedAt,
    source: String(e.source),
  }));

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
  let lateMinutes = 0;
  let undertimeMinutes = 0;

  if (assignments.length > 0) {
    const holidayResolver = createHolidayResolver(organizationId);
    const m = await computeReconciledSummaryMetrics(
      eventInputs,
      shiftInputs,
      options.userId,
      holidayResolver,
    );
    firstInAt = m.firstInAt;
    lastOutAt = m.lastOutAt;
    minutesWorked = m.minutesWorked;
    overtimeMinutes = m.overtimeMinutes;
    holidayOvertimeMinutes = m.holidayOvertimeMinutes;
    publicHolidayName = m.publicHolidayName;
    summaryStatus = m.summaryStatus;
  } else {
    const legacy = legacyFirstLastMetrics(eventInputs);
    firstInAt = legacy.firstInAt;
    lastOutAt = legacy.lastOutAt;
    minutesWorked = legacy.minutesWorked;
    overtimeMinutes = legacy.overtimeMinutes;
    summaryStatus = legacy.summaryStatus;
  }

  // Late & undertime are only meaningful against a scheduled shift.
  if (assignments.length > 0) {
    const earliestStart = new Date(Math.min(...assignments.map((a) => a.startsAt.getTime())));
    if (firstInAt && firstInAt.getTime() > earliestStart.getTime()) {
      const rawLate = Math.round((firstInAt.getTime() - earliestStart.getTime()) / 60000);
      lateMinutes = Math.max(0, rawLate - graceInMinutes);
    }
    const scheduledMinutes = assignments.reduce(
      (sum, a) =>
        sum +
        Math.max(0, Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60000) - a.breakMinutes),
      0,
    );
    undertimeMinutes = Math.max(0, scheduledMinutes - minutesWorked);
  }

  const sourceBreakdown = {
    biometric: events.filter((e) => e.source === 'biometric').length,
    manual: events.filter((e) => e.source === 'manual').length,
    rota: events.filter((e) => e.source === 'rota').length,
    mobile_geo: events.filter((e) => e.source === 'mobile_geo').length,
  };

  const summary = await db.staffAttendanceDaySummary.upsert({
    where: { userId_workDate: { userId: options.userId, workDate } },
    create: {
      organizationId,
      userId: options.userId,
      workDate,
      staffAttendancePolicyId: policyAssignment?.staffAttendancePolicyId ?? null,
      firstInAt,
      lastOutAt,
      minutesWorked,
      lateMinutes,
      undertimeMinutes,
      overtimeMinutes,
      holidayOvertimeMinutes,
      publicHolidayName,
      status: summaryStatus,
      sourceBreakdown,
    },
    update: {
      staffAttendancePolicyId: policyAssignment?.staffAttendancePolicyId ?? null,
      firstInAt,
      lastOutAt,
      minutesWorked,
      lateMinutes,
      undertimeMinutes,
      overtimeMinutes,
      holidayOvertimeMinutes,
      publicHolidayName,
      status: summaryStatus,
      sourceBreakdown,
    },
  });

  await db.staffAttendanceException.deleteMany({
    where: { userId: options.userId, workDate, status: 'open' },
  });

  const exceptionRows: Array<{ type: 'missing_check_in' | 'missing_check_out'; description: string }> = [];
  if (!firstInAt) {
    exceptionRows.push({ type: 'missing_check_in', description: 'No check-in event found for this shift/day window.' });
  }
  if (!lastOutAt) {
    exceptionRows.push({ type: 'missing_check_out', description: 'No check-out event found for this shift/day window.' });
  }

  if (exceptionRows.length > 0) {
    await db.staffAttendanceException.createMany({
      data: exceptionRows.map((item) => ({
        organizationId,
        userId: options.userId,
        staffAttendanceDaySummaryId: summary.id,
        workDate,
        type: item.type,
        description: item.description,
      })),
    });
  }

  return summary;
}
