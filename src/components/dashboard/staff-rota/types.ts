export type StaffSubject = {
  id: string;
  name: string;
  email: string;
  staffUserType: string;
  department: string | null;
  role: string;
  policy: {
    key: string;
    label: string;
    minRestHours: number;
    maxWeekWorkHours: number;
  };
};

export type StaffShiftTemplate = {
  id: string;
  name: string;
  startMinutes: number;
  endMinutes: number;
  breakMinutes: number;
  color: string | null;
  isActive: boolean;
};

export type StaffRotaPeriod = {
  id: string;
  name: string | null;
  startDate: string;
  endDate: string;
  status: 'draft' | 'published';
  _count?: { assignments: number };
};

export type StaffAssignment = {
  id: string;
  staffRotaPeriodId: string;
  userId: string;
  staffShiftTemplateId: string | null;
  workDate: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  notes: string | null;
  user?: { id: string; name: string; email: string; department: string | null; staffUserType: string };
  shiftTemplate?: { id: string; name: string; color: string | null } | null;
};

export type StaffRotaConflict = {
  type:
    | 'overlap'
    | 'insufficient_rest'
    | 'max_shift_length'
    | 'weekly_hours_cap'
    | 'max_consecutive_days'
    | 'coverage_understaffed';
  severity: 'error' | 'warning';
  userId: string | null;
  message: string;
  assignmentIds: string[];
  details?: Record<string, unknown>;
};

export type OperationResult = {
  title: string;
  created?: number;
  updated?: number;
  deleted?: number;
  skipped?: number;
  message?: string;
};

export type ImportPreviewRow = {
  row: number;
  staff: string;
  workDate: string;
  userId?: string | null;
  userName?: string;
  matchReason?: string;
  templateId?: string | null;
  templateName?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  breakMinutes?: number;
  error?: string;
};
