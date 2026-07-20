/**
 * Human-friendly formatting for the admin audit log.
 *
 * Audit events are stored with terse, machine-oriented strings
 * (`payroll.records.view`, `PayrollBatch`, raw JSON metadata, HTTP routes).
 * This module turns those into plain-English descriptions that anyone — not
 * just engineers — can read at a glance, while still keeping the underlying
 * technical values available for traceability.
 */

import { toDisplayLabel } from '@/lib/format-label';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Past-tense, human verbs keyed by the final segment of an action string
 * (e.g. `payroll.records.view` -> `view` -> "Viewed").
 */
const VERB_MAP: Record<string, string> = {
  view: 'Viewed',
  viewed: 'Viewed',
  list: 'Viewed',
  read: 'Viewed',
  create: 'Created',
  created: 'Created',
  add: 'Added',
  added: 'Added',
  update: 'Updated',
  updated: 'Updated',
  edit: 'Updated',
  edited: 'Updated',
  delete: 'Deleted',
  deleted: 'Deleted',
  remove: 'Removed',
  removed: 'Removed',
  archive: 'Archived',
  archived: 'Archived',
  export: 'Exported',
  exported: 'Exported',
  download: 'Downloaded',
  downloaded: 'Downloaded',
  upload: 'Uploaded',
  uploaded: 'Uploaded',
  import: 'Imported',
  imported: 'Imported',
  generate: 'Generated',
  generated: 'Generated',
  send: 'Sent',
  sent: 'Sent',
  submit: 'Submitted',
  submitted: 'Submitted',
  approve: 'Approved',
  approved: 'Approved',
  reject: 'Rejected',
  rejected: 'Rejected',
  cancel: 'Cancelled',
  cancelled: 'Cancelled',
  decline: 'Declined',
  declined: 'Declined',
  assign: 'Assigned',
  assigned: 'Assigned',
  assigned_external: 'Assigned',
  unassign: 'Removed assignment for',
  unassigned: 'Removed assignment for',
  verify: 'Verified',
  verified: 'Verified',
  connect: 'Connected',
  connected: 'Connected',
  disconnect: 'Disconnected',
  disconnected: 'Disconnected',
  duplicate: 'Duplicated',
  duplicated: 'Duplicated',
  grade: 'Graded',
  graded: 'Graded',
  complete: 'Completed',
  completed: 'Completed',
  renew: 'Renewed',
  renewed: 'Renewed',
  prepare: 'Prepared',
  prepared: 'Prepared',
  sign: 'Signed',
  signed: 'Signed',
  poll: 'Checked',
  polled: 'Checked',
  delegated: 'Delegated',
  reminded: 'Sent a reminder for',
};

/**
 * Full-action overrides for cases the generic verb/object parser can't phrase
 * naturally. Keyed by the exact action string.
 */
const ACTION_OVERRIDES: Record<string, string> = {
  'auth.login.succeeded': 'Signed in',
  'auth.login.failed': 'Failed sign-in attempt',
  'auth.login.mfa_challenge': 'Started two-factor verification',
  'ess.login.succeeded': 'Employee signed in',
  'ess.login.failed': 'Employee failed sign-in',
  'staff_attendance.manual_override': 'Manually adjusted attendance',
  'staff_biometric.import': 'Imported biometric records',
  'staff_biometric_device.test_connection': 'Tested biometric device connection',
  'staff_biometric_device.poll': 'Synced biometric device',
  'staff_rota.import.commit': 'Imported staff rota',
  'staff_rota.assignment.batch_create': 'Created multiple shift assignments',
  'application.status_changed': 'Changed application status',
  'leave.step_approved': 'Approved a leave step',
  'workflow.delegated': 'Delegated a workflow task',
  'workflow.escalation_sweep': 'Ran workflow escalation sweep',
  'performance.review.ai_suggestions': 'Generated AI review suggestions',
  'performance.jd.pdf_exported': 'Exported job description PDF',
  'performance.jd.reference_pack.imported': 'Imported job description reference pack',
  'payroll.records.view': 'Viewed payroll records',
  'payroll.run.approve': 'Approved a payroll run',
  'payroll.bank_export.generated': 'Generated bank payment file',
  'payroll.gl.export': 'Exported general ledger entries',
  'payroll.p10.export': 'Exported P10 statutory report',
  'payroll.p9.generate': 'Generated P9 forms',
  'payroll.disbursement.submitted': 'Submitted payroll disbursement',
  'payroll.disbursement.polled': 'Checked disbursement status',
  'ats.hire_conversion.completed': 'Completed a hire',
  'ats.assessment.retention_purged': 'Purged old assessment data',
  'employee.lifecycle.action': 'Performed an employee lifecycle action',
  'accounts.vendor_bill.created': 'Created a vendor bill',
  'accounts.invoice.created': 'Created an invoice',
  'company_setup.updated': 'Updated company setup',
  'operating_entities.updated': 'Updated operating entities',
};

/** Friendly names for common entity types (falls back to a smart split). */
const ENTITY_TYPE_MAP: Record<string, string> = {
  PayrollBatch: 'Payroll batch',
  CompanyAsset: 'Asset',
  AssetMaintenance: 'Asset maintenance',
  AssetAttachment: 'Asset attachment',
  StaffAttendanceEvent: 'Attendance record',
  StaffAttendanceDaySummary: 'Attendance summary',
  StaffAttendanceWorkSite: 'Work site',
  StaffAttendancePolicy: 'Attendance policy',
  StaffAttendancePolicyAssignment: 'Attendance policy assignment',
  StaffShiftAssignment: 'Shift assignment',
  StaffShiftTemplate: 'Shift template',
  StaffRotaPeriod: 'Rota period',
  StaffLeaveApplication: 'Leave application',
  StaffBiometricDevice: 'Biometric device',
  DisciplinaryCase: 'Disciplinary case',
  QuestionBankItem: 'Question bank item',
  ApplicationAssessmentAttempt: 'Assessment attempt',
  ExternalAssessmentInvite: 'External assessment invite',
  AssessmentProviderConnection: 'Assessment provider',
  AssessmentTemplate: 'Assessment template',
  TrainingProgram: 'Training program',
  SystemSetting: 'System setting',
  CompanyDocument: 'Company document',
};

/** Visual tone for the action badge — drives colour coding in the UI. */
export type AuditTone = 'neutral' | 'read' | 'create' | 'update' | 'delete' | 'auth' | 'danger';

const ACRONYM_RE = /^[A-Z0-9]+$/;

/** Lower-cases a phrase for use after a verb, keeping acronyms (KRA, ATS…) uppercase. */
function toObjectPhrase(phrase: string): string {
  const label = toDisplayLabel(phrase);
  const firstWord = label.split(' ')[0] ?? '';
  if (ACRONYM_RE.test(firstWord)) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** "PascalCaseName" / "snake_case" -> "Pascal case name". */
function humanizeIdentifier(raw: string): string {
  const spaced = raw.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return toDisplayLabel(spaced);
}

/** Turns an action string into a plain-English description. */
export function describeAuditAction(action: string): string {
  if (!action) return 'Unknown action';
  if (ACTION_OVERRIDES[action]) return ACTION_OVERRIDES[action];

  const parts = action.split('.');
  const last = parts[parts.length - 1] ?? '';
  const verb = VERB_MAP[last];
  if (verb) {
    const objectTokens = parts.slice(0, -1);
    if (objectTokens.length === 0) return verb;
    const object = toObjectPhrase(objectTokens.join(' '));
    return `${verb} ${object}`;
  }

  // No recognised verb — present the whole thing as a readable phrase.
  return humanizeIdentifier(action.replace(/\./g, ' '));
}

/** Colour tone for an action, inferred from its keywords. */
export function auditActionTone(action: string): AuditTone {
  const a = action.toLowerCase();
  if (/(fail|reject|declin|cancel)/.test(a)) return 'danger';
  if (/(login|auth|mfa|signed in|sign_in)/.test(a)) return 'auth';
  if (/(delete|remove|archiv|disconnect|unassign|purg)/.test(a)) return 'delete';
  if (/(creat|generat|import|upload|connect|assign|submit|renew|duplicat|complet|approve|\.add|hire|prepared)/.test(a))
    return 'create';
  if (/(view|list|export|download|\.sent|\.send|poll|read|suggestions)/.test(a)) return 'read';
  if (/(updat|edit|verif|chang|override|remind|deleg)/.test(a)) return 'update';
  return 'neutral';
}

/** Friendly name for an entity type. */
export function describeEntityType(entityType: string): string {
  if (!entityType) return '';
  if (ENTITY_TYPE_MAP[entityType]) return ENTITY_TYPE_MAP[entityType];
  return humanizeIdentifier(entityType);
}

function isOpaqueId(id: string): boolean {
  // cuid (c + 24 chars) or uuid — not meaningful to a human reader.
  return /^c[a-z0-9]{20,}$/i.test(id) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(id);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function periodFromMonthYear(metadata: unknown): string | null {
  if (!isPlainObject(metadata)) return null;
  const year = metadata.year;
  const month = metadata.month;
  if (typeof year === 'number' && typeof month === 'number' && month >= 1 && month <= 12) {
    return `${MONTHS[month - 1]} ${year}`;
  }
  if (typeof year === 'number' && typeof month !== 'number') return String(year);
  return null;
}

/**
 * A short, human reference for the affected item (e.g. "July 2026" for a
 * payroll batch). Returns `null` when the only identifier is an opaque ID.
 */
export function describeEntityReference(
  entityType: string,
  entityId: string | null,
  metadata: unknown,
): string | null {
  const period = periodFromMonthYear(metadata);
  if (entityType === 'PayrollBatch') {
    if (period) return period;
    if (entityId) {
      const [y, m] = entityId.split('-');
      const yn = Number(y);
      const mn = Number(m);
      if (yn && mn >= 1 && mn <= 12) return `${MONTHS[mn - 1]} ${yn}`;
      if (yn) return String(yn);
    }
    return null;
  }
  if (!entityId) return period;
  if (isOpaqueId(entityId)) return period;
  return entityId;
}

export interface AuditDetail {
  label: string;
  value: string;
}

const KEY_LABEL_OVERRIDES: Record<string, string> = {
  count: 'Records',
  rows: 'Records',
  departmentId: 'Department',
  clientId: 'Client',
  reviewNote: 'Note',
  stepOrder: 'Approval step',
  nextStepOrder: 'Next step',
  pageSize: 'Page size',
};

function humanizeKey(key: string): string {
  if (KEY_LABEL_OVERRIDES[key]) return KEY_LABEL_OVERRIDES[key];
  return humanizeIdentifier(key);
}

function formatScalar(key: string, value: unknown): string {
  if (value === null || value === undefined) {
    if (key === 'departmentId') return 'All departments';
    if (key === 'clientId') return 'All clients';
    return '—';
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (key === 'month' && value >= 1 && value <= 12) return MONTHS[value - 1];
    return value.toLocaleString();
  }
  if (typeof value === 'string') {
    if (isOpaqueId(value)) return `${value.slice(0, 8)}…`;
    return value;
  }
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    return keys.length ? `${keys.length} field${keys.length === 1 ? '' : 's'}` : '—';
  }
  return String(value);
}

/**
 * Flattens metadata into a small list of "Label: value" pairs suitable for
 * display. Nested objects/arrays are summarised rather than dumped as JSON.
 */
export function describeMetadata(metadata: unknown): AuditDetail[] {
  if (!isPlainObject(metadata)) return [];
  return Object.entries(metadata).map(([key, value]) => ({
    label: humanizeKey(key),
    value: formatScalar(key, value),
  }));
}
