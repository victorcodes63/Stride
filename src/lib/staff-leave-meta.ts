/**
 * Structured metadata for internal-staff leave requests.
 *
 * The `StaffLeaveApplication.reason` column is plain text and we cannot add DB
 * columns, so structured operational context is packed into the free-text field
 * inside a single, well-formed JSON block:
 *
 *   [StaffLeaveMeta]{"team":"Operations", ... }[/StaffLeaveMeta]
 *   <the human-readable reason follows here>
 *
 * Legacy rows used a line-based `[StaffLeaveOps]` block (and, before that, a
 * clinical `[HospitalContext]` block). Both are still parsed so historic
 * requests keep rendering correctly. New writes always use the JSON block.
 */

export type LeavePriority = 'routine' | 'standard' | 'high';

export type StaffLeaveMeta = {
  /** Team / department the requester belongs to (was "unit/ward"). */
  team: string;
  /** Job role of the requester. */
  role: string;
  /** How business-critical cover is while away (was "criticality"). */
  priority: LeavePriority;
  /** Who/what keeps the work running while away (was "coverage plan"). */
  coveragePlan: string;
  /** Handover notes for the covering colleague. */
  handoverNotes: string;
  /** Named backup colleague (was "relief officer"). */
  backupPerson: string;
  /** How to reach the requester in an emergency (was "contact during leave"). */
  contactWhileAway: string;
};

export const EMPTY_STAFF_LEAVE_META: StaffLeaveMeta = {
  team: '',
  role: '',
  priority: 'standard',
  coveragePlan: '',
  handoverNotes: '',
  backupPerson: '',
  contactWhileAway: '',
};

export const LEAVE_PRIORITY_LABELS: Record<LeavePriority, string> = {
  routine: 'Routine',
  standard: 'Standard',
  high: 'High priority',
};

export const LEAVE_PRIORITY_OPTIONS: Array<{ value: LeavePriority; label: string }> = [
  { value: 'routine', label: LEAVE_PRIORITY_LABELS.routine },
  { value: 'standard', label: LEAVE_PRIORITY_LABELS.standard },
  { value: 'high', label: LEAVE_PRIORITY_LABELS.high },
];

const META_OPEN = '[StaffLeaveMeta]';
const META_CLOSE = '[/StaffLeaveMeta]';
/** Legacy line-based block — still parsed for older rows. */
const OPS_OPEN = '[StaffLeaveOps]';
const OPS_CLOSE = '[/StaffLeaveOps]';
/** Original clinical block — still parsed for the oldest rows. */
const LEGACY_OPEN = '[HospitalContext]';
const LEGACY_CLOSE = '[/HospitalContext]';

function normalizePriority(value: unknown): LeavePriority {
  const raw = String(value ?? '').trim().toLowerCase();
  // New values.
  if (raw === 'routine') return 'routine';
  if (raw === 'standard') return 'standard';
  if (raw === 'high') return 'high';
  // Legacy clinical values.
  if (raw === 'essential') return 'standard';
  if (raw === 'critical') return 'high';
  return 'standard';
}

function coerceMeta(partial: Partial<Record<keyof StaffLeaveMeta, unknown>>): StaffLeaveMeta {
  return {
    team: String(partial.team ?? '').trim(),
    role: String(partial.role ?? '').trim(),
    priority: normalizePriority(partial.priority),
    coveragePlan: String(partial.coveragePlan ?? '').trim(),
    handoverNotes: String(partial.handoverNotes ?? '').trim(),
    backupPerson: String(partial.backupPerson ?? '').trim(),
    contactWhileAway: String(partial.contactWhileAway ?? '').trim(),
  };
}

function parseJsonBlock(reason: string): { core: string; meta: StaffLeaveMeta } | null {
  const start = reason.indexOf(META_OPEN);
  const end = reason.indexOf(META_CLOSE);
  if (start === -1 || end === -1 || end < start) return null;
  const json = reason.slice(start + META_OPEN.length, end).trim();
  const core = (reason.slice(0, start) + reason.slice(end + META_CLOSE.length)).trim();
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return { core, meta: coerceMeta(parsed) };
  } catch {
    return null;
  }
}

function parseLineBlock(
  reason: string,
  openTag: string,
  closeTag: string,
): { core: string; meta: StaffLeaveMeta } | null {
  const start = reason.indexOf(openTag);
  const end = reason.indexOf(closeTag);
  if (start === -1 || end === -1 || end < start) return null;
  const block = reason.slice(start + openTag.length, end).trim();
  const core = reason.slice(end + closeTag.length).trim();
  const map = new Map<string, string>();
  for (const line of block.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (key) map.set(key, val === '-' ? '' : val);
  }
  return {
    core,
    meta: coerceMeta({
      team: map.get('unit') ?? map.get('team'),
      role: map.get('role'),
      priority: map.get('criticality') ?? map.get('priority'),
      coveragePlan: map.get('coverage') ?? map.get('coverage plan'),
      handoverNotes: map.get('handover') ?? map.get('handover notes'),
      backupPerson: map.get('relief officer') ?? map.get('backup') ?? map.get('backup person'),
      contactWhileAway: map.get('contact') ?? map.get('contact while away'),
    }),
  };
}

export type ParsedStaffLeaveReason = {
  /** The human-readable reason with all metadata blocks stripped out. */
  coreReason: string;
  /** Structured metadata if any block was present, otherwise null. */
  meta: StaffLeaveMeta | null;
};

/** Parse a stored `reason` into its core text + structured metadata (any format). */
export function parseStaffLeaveReason(reason?: string | null): ParsedStaffLeaveReason {
  if (!reason) return { coreReason: '', meta: null };
  const fromJson = parseJsonBlock(reason);
  if (fromJson) return { coreReason: fromJson.core, meta: fromJson.meta };
  const fromOps = parseLineBlock(reason, OPS_OPEN, OPS_CLOSE);
  if (fromOps) return { coreReason: fromOps.core, meta: fromOps.meta };
  const fromLegacy = parseLineBlock(reason, LEGACY_OPEN, LEGACY_CLOSE);
  if (fromLegacy) return { coreReason: fromLegacy.core, meta: fromLegacy.meta };
  return { coreReason: reason.trim(), meta: null };
}

/** Serialize core reason + metadata into a single clean JSON block for storage. */
export function serializeStaffLeaveReason(coreReason: string, meta: StaffLeaveMeta): string {
  const clean = coerceMeta(meta);
  const block = `${META_OPEN}${JSON.stringify(clean)}${META_CLOSE}`;
  const core = coreReason.trim();
  return core ? `${block}\n${core}` : block;
}

export type LeaveRiskLevel = 'low' | 'medium' | 'high';

export type LeaveRisk = {
  level: LeaveRiskLevel;
  label: string;
  /** dashStatusChip tone. */
  tone: 'success' | 'warning' | 'danger';
  reasons: string[];
};

function daysFromToday(targetIsoDate: string): number {
  const target = new Date(`${targetIsoDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Coverage-risk heuristic for approvers: short notice, long absences,
 * high-priority roles, and missing coverage all raise the score.
 */
export function computeLeaveRisk(input: {
  startDate: string;
  totalDays: number;
  meta: StaffLeaveMeta | null;
}): LeaveRisk {
  const { startDate, totalDays, meta } = input;
  const reasons: string[] = [];
  let score = 0;

  const lead = daysFromToday(startDate);
  if (lead < 3) {
    score += 2;
    reasons.push('Short notice (under 3 days)');
  }
  if (totalDays >= 7) {
    score += 1;
    reasons.push('Long absence (7+ days)');
  }
  if (meta?.priority === 'high') {
    score += 2;
    reasons.push('High-priority role');
  } else if (meta?.priority === 'standard') {
    score += 1;
  }
  if (!meta?.coveragePlan) {
    score += 1;
    reasons.push('No coverage plan');
  }

  if (score >= 4) return { level: 'high', label: 'High risk', tone: 'danger', reasons };
  if (score >= 2) return { level: 'medium', label: 'Medium risk', tone: 'warning', reasons };
  return { level: 'low', label: 'Low risk', tone: 'success', reasons };
}
