import type { FleetDriverStatus, FleetMaintenanceType } from '@prisma/client';

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
      return 'bg-emerald-50 text-emerald-800';
    case 'on_trip':
      return 'bg-blue-50 text-blue-800';
    case 'off_duty':
      return 'bg-neutral-100 text-neutral-600';
    case 'suspended':
      return 'bg-red-50 text-red-800';
    default:
      return 'bg-neutral-100 text-neutral-600';
  }
}
