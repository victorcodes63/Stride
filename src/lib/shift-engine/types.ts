/**
 * Pure data shapes for the attendance / shift engine (M2).
 * Prisma types must not be imported here — map at the repository boundary.
 */

export type ISODateTimeString = string;

export interface BiometricPunch {
  id: string;
  employeeId: string;
  /** Device-reported or CSV row instant (UTC or stable offset). */
  at: ISODateTimeString;
  type: 'in' | 'out' | 'unknown';
  source: 'device' | 'manual';
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  /** Scheduled wall-clock start (local timezone policy applied upstream). */
  scheduledStart: ISODateTimeString;
  /** Scheduled end; may cross midnight (R1, R2). */
  scheduledEnd: ISODateTimeString;
}

export interface OvertimeConfig {
  /** Minutes beyond scheduled length before overtime is counted (policy layer). */
  dailyThresholdMinutes?: number;
  weeklyThresholdMinutes?: number;
}

export interface AttendanceRecord {
  employeeId: string;
  shiftAssignmentId: string;
  start: ISODateTimeString;
  end: ISODateTimeString | null;
  status: 'closed' | 'pending_review';
}

export interface OvertimeRecord {
  employeeId: string;
  shiftAssignmentId: string;
  minutes: number;
}
