import type { FleetTripStatus } from '@prisma/client';
import { dashStatusChip } from '@/lib/dashboard-status-chips';

export const FLEET_TRIP_STATUSES: FleetTripStatus[] = [
  'planned',
  'allocated',
  'compliance_check',
  'loaded',
  'in_transit',
  'delivered',
  'settled',
  'invoiced',
  'closed',
  'exception',
];

export const FLEET_TRIP_STATUS_LABELS: Record<FleetTripStatus, string> = {
  planned: 'Planned',
  allocated: 'Allocated',
  compliance_check: 'Compliance',
  loaded: 'Loaded',
  in_transit: 'In transit',
  delivered: 'Delivered',
  settled: 'Settled',
  invoiced: 'Invoiced',
  closed: 'Closed',
  exception: 'Exception',
};

export const FLEET_TRIP_BOARD_COLUMNS: { id: FleetTripStatus; label: string }[] = [
  { id: 'planned', label: 'Planned' },
  { id: 'allocated', label: 'Allocated' },
  { id: 'compliance_check', label: 'Compliance' },
  { id: 'loaded', label: 'Loaded' },
  { id: 'in_transit', label: 'In transit' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'settled', label: 'Settled' },
  { id: 'invoiced', label: 'Invoiced' },
  { id: 'closed', label: 'Closed' },
  { id: 'exception', label: 'Exception' },
];

/** Primary logistics workflow — single source of truth for happy-path order. */
export const FLEET_TRIP_LIFECYCLE_ORDER: FleetTripStatus[] = [
  'planned',
  'allocated',
  'compliance_check',
  'loaded',
  'in_transit',
  'delivered',
  'settled',
  'invoiced',
];

export type FleetTripStatusActor = 'staff' | 'driver';

/** Staff may advance the workflow, mark exception, or recover from exception. */
export const STAFF_TRIP_STATUS_TRANSITIONS: Partial<Record<FleetTripStatus, FleetTripStatus[]>> = {
  planned: ['allocated', 'exception'],
  allocated: ['compliance_check', 'exception'],
  compliance_check: ['loaded', 'exception'],
  loaded: ['in_transit', 'exception'],
  in_transit: ['delivered', 'exception'],
  delivered: ['settled', 'exception'],
  settled: ['invoiced'],
  invoiced: ['closed'],
  exception: ['allocated', 'in_transit', 'delivered'],
  closed: [],
};

/** Driver ESS transitions — subset of staff workflow. */
export const DRIVER_TRIP_STATUS_TRANSITIONS: Partial<Record<FleetTripStatus, FleetTripStatus[]>> = {
  compliance_check: ['loaded'],
  loaded: ['in_transit'],
  in_transit: ['delivered'],
  exception: ['in_transit', 'delivered'],
};

export function getAllowedNextTripStatuses(
  current: FleetTripStatus,
  actor: FleetTripStatusActor,
): FleetTripStatus[] {
  const map = actor === 'staff' ? STAFF_TRIP_STATUS_TRANSITIONS : DRIVER_TRIP_STATUS_TRANSITIONS;
  return map[current] ?? [];
}

export function canTransitionTripStatus(
  current: FleetTripStatus,
  next: FleetTripStatus,
  actor: FleetTripStatusActor,
): boolean {
  if (current === next) return true;
  return getAllowedNextTripStatuses(current, actor).includes(next);
}

export function fleetTripStatusBadgeClass(status: FleetTripStatus): string {
  switch (status) {
    case 'planned':
    case 'allocated':
      return dashStatusChip('neutral');
    case 'compliance_check':
    case 'loaded':
      return dashStatusChip('warning');
    case 'in_transit':
      return dashStatusChip('info');
    case 'delivered':
    case 'settled':
      return dashStatusChip('success');
    case 'invoiced':
    case 'closed':
      return dashStatusChip('neutral');
    case 'exception':
      return dashStatusChip('danger');
    default:
      return dashStatusChip('neutral');
  }
}
