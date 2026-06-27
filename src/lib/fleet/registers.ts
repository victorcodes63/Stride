import type { FleetDriverStatus, FleetMaintenanceType } from '@prisma/client';
import { dashStatusChip } from '@/lib/dashboard-status-chips';

export const FLEET_DRIVER_STATUS_LABELS: Record<FleetDriverStatus, string> = {
  available: 'Available',
  on_trip: 'On trip',
  off_duty: 'Off duty',
  suspended: 'Suspended',
};

export const FLEET_MAINTENANCE_TYPE_LABELS: Record<FleetMaintenanceType, string> = {
  service: 'Scheduled service',
  repair: 'Repair',
  inspection: 'Inspection',
  tyre: 'Tyre / wheels',
  other: 'Other',
};

export const FLEET_MAINTENANCE_TYPES = Object.keys(
  FLEET_MAINTENANCE_TYPE_LABELS,
) as FleetMaintenanceType[];

export function fleetDriverStatusBadgeClass(status: FleetDriverStatus): string {
  switch (status) {
    case 'available':
      return dashStatusChip('success');
    case 'on_trip':
      return dashStatusChip('info');
    case 'off_duty':
      return dashStatusChip('neutral');
    case 'suspended':
      return dashStatusChip('danger');
    default:
      return dashStatusChip('neutral');
  }
}
