/**
 * Serializers + shared shaping for the tenant-own Attendance API.
 *
 * Keeps the wire shape consistent across the summaries table, exceptions inbox,
 * live board, and CSV export so the client can rely on one set of types.
 */

type UserLite = { id: string; name: string; email: string; department: string | null } | null;

export type SerializedStaffSummary = {
  id: string;
  userId: string;
  workDate: string;
  firstInAt: string | null;
  lastOutAt: string | null;
  minutesWorked: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  holidayOvertimeMinutes: number;
  publicHolidayName: string | null;
  status: 'draft' | 'reconciled' | 'approved';
  sourceBreakdown: Record<string, number> | null;
  user: { id: string; name: string; email: string; department: string | null } | null;
};

export type SerializedStaffException = {
  id: string;
  userId: string;
  workDate: string;
  type: string;
  status: 'open' | 'resolved' | 'ignored';
  description: string;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  resolvedByUser: { id: string; name: string } | null;
  user: { id: string; name: string; email: string; department: string | null } | null;
};

type RawSummary = {
  id: string;
  userId: string;
  workDate: Date;
  firstInAt: Date | null;
  lastOutAt: Date | null;
  minutesWorked: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  holidayOvertimeMinutes: number;
  publicHolidayName: string | null;
  status: string;
  sourceBreakdown: unknown;
  user?: UserLite;
};

type RawException = {
  id: string;
  userId: string;
  workDate: Date;
  type: string;
  status: string;
  description: string;
  resolutionNotes: string | null;
  resolvedAt: Date | null;
  resolvedByUser?: { id: string; name: string } | null;
  user?: UserLite;
};

export function serializeStaffSummary(row: RawSummary): SerializedStaffSummary {
  return {
    id: row.id,
    userId: row.userId,
    workDate: row.workDate.toISOString().slice(0, 10),
    firstInAt: row.firstInAt ? row.firstInAt.toISOString() : null,
    lastOutAt: row.lastOutAt ? row.lastOutAt.toISOString() : null,
    minutesWorked: row.minutesWorked,
    lateMinutes: row.lateMinutes,
    undertimeMinutes: row.undertimeMinutes,
    overtimeMinutes: row.overtimeMinutes,
    holidayOvertimeMinutes: row.holidayOvertimeMinutes,
    publicHolidayName: row.publicHolidayName,
    status: (row.status as SerializedStaffSummary['status']) ?? 'draft',
    sourceBreakdown:
      row.sourceBreakdown && typeof row.sourceBreakdown === 'object'
        ? (row.sourceBreakdown as Record<string, number>)
        : null,
    user: row.user
      ? { id: row.user.id, name: row.user.name, email: row.user.email, department: row.user.department }
      : null,
  };
}

export function serializeStaffException(row: RawException): SerializedStaffException {
  return {
    id: row.id,
    userId: row.userId,
    workDate: row.workDate.toISOString().slice(0, 10),
    type: row.type,
    status: (row.status as SerializedStaffException['status']) ?? 'open',
    description: row.description,
    resolutionNotes: row.resolutionNotes,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolvedByUser: row.resolvedByUser ? { id: row.resolvedByUser.id, name: row.resolvedByUser.name } : null,
    user: row.user
      ? { id: row.user.id, name: row.user.name, email: row.user.email, department: row.user.department }
      : null,
  };
}

/** Convert a YYYY-MM-DD string to a UTC midnight Date (matches @db.Date storage). */
export function toWorkDateUtc(input: string): Date {
  return new Date(`${input}T00:00:00.000Z`);
}

/** Today's work date in YYYY-MM-DD (UTC), matching how events are keyed. */
export function todayWorkDate(): string {
  return new Date().toISOString().slice(0, 10);
}
