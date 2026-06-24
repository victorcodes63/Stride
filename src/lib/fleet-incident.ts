import type {
  FleetIncidentSeverity,
  FleetIncidentStatus,
  FleetIncidentType,
} from '@prisma/client';

export const FLEET_INCIDENT_TYPES: FleetIncidentType[] = [
  'breakdown',
  'accident',
  'delay',
  'dispute',
];

export const FLEET_INCIDENT_TYPE_LABELS: Record<FleetIncidentType, string> = {
  breakdown: 'Breakdown',
  accident: 'Accident',
  delay: 'Delay',
  dispute: 'Dispute',
};

export const FLEET_INCIDENT_SEVERITY_LABELS: Record<FleetIncidentSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const FLEET_INCIDENT_STATUS_LABELS: Record<FleetIncidentStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  resolved: 'Resolved',
  closed: 'Closed',
};

export function fleetIncidentSeverityBadgeClass(severity: FleetIncidentSeverity): string {
  switch (severity) {
    case 'high':
      return 'bg-red-50 text-red-800';
    case 'medium':
      return 'bg-amber-50 text-amber-800';
    default:
      return 'bg-neutral-100 text-neutral-700';
  }
}

export function fleetIncidentStatusBadgeClass(status: FleetIncidentStatus): string {
  switch (status) {
    case 'resolved':
    case 'closed':
      return 'bg-emerald-50 text-emerald-800';
    case 'investigating':
      return 'bg-sky-50 text-sky-800';
    default:
      return 'bg-red-50 text-red-800';
  }
}
