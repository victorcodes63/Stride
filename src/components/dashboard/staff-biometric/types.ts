export type StaffBiometricDevice = {
  id: string;
  name: string;
  adapterKind: string;
  isActive: boolean;
  host: string | null;
  port: number | null;
  notes: string | null;
  timezone: string | null;
  useHttps: boolean;
  hasCredentials: boolean;
  supportsConnection: boolean;
  lastPollAt: string | null;
  createdAt: string;
  punchCount: number;
  punches24h: number;
  punches7d: number;
  unmatchedPunchCount: number;
  distinctSubjectCount: number;
  mappedSubjectCount: number;
  lastObservedAt: string | null;
  stale: boolean;
};

export type StaffBiometricOverview = {
  totalDevices: number;
  activeDevices: number;
  inactiveDevices: number;
  staleDevices: number;
  lastPollAt: string | null;
  lastObservedAt: string | null;
  punches24h: number;
  punches7d: number;
  totalPunches: number;
  unmatchedPunches: number;
  matchedRate: number;
};

export type StaffBiometricPunch = {
  id: string;
  deviceId: string;
  deviceName: string;
  observedAt: string;
  rawSubjectId: string;
  direction: 'in' | 'out' | 'unknown';
  source: 'device' | 'csv';
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
};

export type StaffOption = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  staffUserType: string;
};

export type ConnectionTestResult = {
  ok: boolean;
  httpStatus?: number;
  latencyMs?: number;
  testedAt?: string;
  error?: string;
  deviceInfo?: Record<string, unknown>;
};

export type ImportPreview = {
  deviceId: string;
  deviceName: string;
  totalRows: number;
  uniqueRows: number;
  duplicateInFile: number;
  alreadyImported: number;
  toImport: number;
  matchedCount: number;
  unmatchedCount: number;
  truncated: boolean;
  rows: Array<{
    rowIndex: number;
    observedAt: string;
    rawSubjectId: string;
    direction: 'in' | 'out' | 'unknown';
    externalEventId: string;
    status: 'new' | 'duplicate_in_file' | 'already_imported';
    matchedUserId: string | null;
    matchedUserName: string | null;
  }>;
  unmatchedSubjects: Array<{ rawSubjectId: string; count: number }>;
};

export const ADAPTER_LABELS: Record<string, string> = {
  hikvision_isapi: 'Hikvision ISAPI',
  csv: 'CSV / Manual',
};

export function adapterLabel(kind: string): string {
  return ADAPTER_LABELS[kind] ?? kind;
}
