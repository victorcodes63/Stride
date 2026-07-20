export type AttendanceStatus = 'draft' | 'reconciled' | 'approved';
export type ExceptionStatus = 'open' | 'resolved' | 'ignored';

export type StaffUserLite = {
  id: string;
  name: string;
  email: string;
  department: string | null;
};

export type AttendanceSummary = {
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
  status: AttendanceStatus;
  sourceBreakdown: Record<string, number> | null;
  user: StaffUserLite | null;
};

export type AttendanceException = {
  id: string;
  userId: string;
  workDate: string;
  type: string;
  status: ExceptionStatus;
  description: string;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  resolvedByUser: { id: string; name: string } | null;
  user: StaffUserLite | null;
};

export type AttendanceKpis = {
  presentToday: number;
  lateToday: number;
  openExceptions: number;
  avgHours: number;
};

export type Subject = {
  id: string;
  name: string;
  email: string;
  staffUserType: string;
  department: string | null;
  role: string;
};

export type LiveBoardEntry = {
  userId: string;
  name: string;
  email: string;
  department: string | null;
  firstInAt: string | null;
  lastOutAt: string | null;
  minutesWorked: number;
  lateMinutes: number;
  state: 'in' | 'completed' | 'missing_check_out' | 'absent';
};

export type LiveBoardCounts = {
  in: number;
  missingCheckOut: number;
  late: number;
  completed: number;
  absent: number;
};

export type AttendancePolicy = {
  id: string;
  name: string;
  description: string | null;
  mode: 'biometric_primary' | 'hybrid_override' | 'manual_primary';
  graceInMinutes: number;
  graceOutMinutes: number;
  minHalfDayMinutes: number;
  fullDayMinutes: number;
  requireManualApproval: boolean;
  mobileGeofenceEnabled: boolean;
  rejectOutsideGeofence: boolean;
  isDefault: boolean;
  isActive: boolean;
  assignedCount: number;
};

export type PolicyAssignment = {
  id: string;
  userId: string;
  staffAttendancePolicyId: string;
  policyName: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isPrimary: boolean;
  user: StaffUserLite | null;
};

export type WorkSite = {
  id: string;
  name: string;
  code: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
};

export type GeofencePolicy = {
  id: string;
  mobileGeofenceEnabled: boolean;
  rejectOutsideGeofence: boolean;
};

export const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  missing_check_in: 'Missing check-in',
  missing_check_out: 'Missing check-out',
  late_arrival: 'Late arrival',
  early_departure: 'Early departure',
  mismatch_with_rota: 'Rota mismatch',
  duplicate_events: 'Duplicate events',
  unapproved_manual_override: 'Unapproved override',
  outside_geofence: 'Outside geofence',
};

export function exceptionTypeLabel(type: string): string {
  return EXCEPTION_TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

export function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(2)}h`;
}

export function formatClock(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
