import type { FleetTripStatus } from '@prisma/client';

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

export function fleetTripStatusBadgeClass(status: FleetTripStatus): string {
  switch (status) {
    case 'planned':
    case 'allocated':
      return 'bg-neutral-100 text-neutral-700';
    case 'compliance_check':
    case 'loaded':
      return 'bg-amber-50 text-amber-800';
    case 'in_transit':
      return 'bg-sky-50 text-sky-800';
    case 'delivered':
    case 'settled':
      return 'bg-emerald-50 text-emerald-800';
    case 'invoiced':
    case 'closed':
      return 'bg-neutral-50 text-neutral-600';
    case 'exception':
      return 'bg-red-50 text-red-800';
    default:
      return 'bg-neutral-100 text-neutral-700';
  }
}
