import type {
  FleetIncidentSeverity,
  FleetIncidentStatus,
  FleetIncidentType,
} from '@prisma/client';
import { dashStatusChip } from '@/lib/dashboard-status-chips';

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
      return dashStatusChip('danger');
    case 'medium':
      return dashStatusChip('warning');
    default:
      return dashStatusChip('neutral');
  }
}

export function fleetIncidentStatusBadgeClass(status: FleetIncidentStatus): string {
  switch (status) {
    case 'resolved':
    case 'closed':
      return dashStatusChip('success');
    case 'investigating':
      return dashStatusChip('info');
    default:
      return dashStatusChip('danger');
  }
}
