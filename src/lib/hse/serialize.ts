import type {
  HseActionStatus,
  HseIncidentSeverity,
  HseIncidentStatus,
  HseIncidentType,
} from '@prisma/client';

export const HSE_INCIDENT_TYPE_LABELS: Record<HseIncidentType, string> = {
  hazard: 'Hazard',
  near_miss: 'Near miss',
  injury: 'Personal injury',
  fire: 'Fire / explosion risk',
  equipment_failure: 'Equipment failure',
  environmental: 'Environmental',
  other: 'Other',
};

export const HSE_SEVERITY_LABELS: Record<HseIncidentSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const HSE_INCIDENT_STATUS_LABELS: Record<HseIncidentStatus, string> = {
  open: 'Open',
  investigating: 'Under investigation',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const HSE_ACTION_STATUS_LABELS: Record<HseActionStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const HSE_ROOT_CAUSE_CATEGORIES = [
  { value: 'human_factor', label: 'Human factor' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'process', label: 'Process' },
  { value: 'environment', label: 'Environment' },
  { value: 'other', label: 'Other' },
] as const;

export const HSE_ROOT_CAUSE_CATEGORY_VALUES: readonly string[] = HSE_ROOT_CAUSE_CATEGORIES.map(
  (c) => c.value,
);

export const HSE_ROOT_CAUSE_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  HSE_ROOT_CAUSE_CATEGORIES.map((c) => [c.value, c.label]),
);

type IncidentRow = {
  id: string;
  incidentNumber: string;
  title: string;
  description: string;
  incidentType: HseIncidentType;
  severity: HseIncidentSeverity;
  status: HseIncidentStatus;
  location: string | null;
  siteName: string | null;
  occurredAt: Date;
  immediateAction: string | null;
  injuredParty: string | null;
  reportedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  rootCause?: string | null;
  rootCauseCategory?: string | null;
  witnessNames?: string | null;
  reportableToAuthority?: boolean;
  lostTimeInjury?: boolean;
  lostTimeDays?: number | null;
  reportedByUser: { name: string } | null;
  reportedByEmployee: { firstName: string; lastName: string } | null;
  actions?: { id: string; status: HseActionStatus }[];
};

export function serializeIncident(incident: IncidentRow) {
  const reporter =
    incident.reportedByUser?.name ??
    (incident.reportedByEmployee
      ? `${incident.reportedByEmployee.firstName} ${incident.reportedByEmployee.lastName}`.trim()
      : null);

  const openActions =
    incident.actions?.filter((a) => a.status === 'open' || a.status === 'in_progress').length ?? 0;

  return {
    id: incident.id,
    incidentNumber: incident.incidentNumber,
    title: incident.title,
    description: incident.description,
    incidentType: incident.incidentType,
    incidentTypeLabel: HSE_INCIDENT_TYPE_LABELS[incident.incidentType],
    severity: incident.severity,
    severityLabel: HSE_SEVERITY_LABELS[incident.severity],
    status: incident.status,
    statusLabel: HSE_INCIDENT_STATUS_LABELS[incident.status],
    location: incident.location,
    siteName: incident.siteName,
    occurredAt: incident.occurredAt.toISOString(),
    immediateAction: incident.immediateAction,
    injuredParty: incident.injuredParty,
    reportedAt: incident.reportedAt.toISOString(),
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    closedAt: incident.closedAt?.toISOString() ?? null,
    rootCause: incident.rootCause ?? null,
    rootCauseCategory: incident.rootCauseCategory ?? null,
    rootCauseCategoryLabel: incident.rootCauseCategory
      ? HSE_ROOT_CAUSE_CATEGORY_LABELS[incident.rootCauseCategory] ?? incident.rootCauseCategory
      : null,
    witnessNames: incident.witnessNames ?? null,
    reportableToAuthority: incident.reportableToAuthority ?? false,
    lostTimeInjury: incident.lostTimeInjury ?? false,
    lostTimeDays: incident.lostTimeDays ?? null,
    reportedBy: reporter,
    openActionCount: openActions,
  };
}

type AttachmentRow = {
  id: string;
  fileName: string;
  fileUrl: string;
  contentType: string | null;
  fileSize: number | null;
  kind: string | null;
  uploadedByUserId: string | null;
  createdAt: Date;
};

export function serializeAttachment(attachment: AttachmentRow) {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    fileUrl: attachment.fileUrl,
    contentType: attachment.contentType,
    fileSize: attachment.fileSize,
    kind: attachment.kind,
    uploadedByUserId: attachment.uploadedByUserId,
    createdAt: attachment.createdAt.toISOString(),
  };
}

type ActionRow = {
  id: string;
  title: string;
  description: string | null;
  status: HseActionStatus;
  dueDate: Date | null;
  completedAt: Date | null;
  incident: { id: string; incidentNumber: string; title: string };
  assignee: { id: string; name: string; email: string } | null;
};

export function serializeAction(action: ActionRow) {
  return {
    id: action.id,
    title: action.title,
    description: action.description,
    status: action.status,
    statusLabel: HSE_ACTION_STATUS_LABELS[action.status],
    dueDate: action.dueDate?.toISOString().slice(0, 10) ?? null,
    completedAt: action.completedAt?.toISOString() ?? null,
    incident: action.incident,
    assignee: action.assignee,
  };
}
