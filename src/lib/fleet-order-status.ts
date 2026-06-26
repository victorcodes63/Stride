import type { FleetOrderStatus } from '@prisma/client';
import { dashStatusChip } from '@/lib/dashboard-status-chips';

export const FLEET_ORDER_STATUSES: FleetOrderStatus[] = [
  'draft',
  'validated',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
];

export const FLEET_ORDER_STATUS_LABELS: Record<FleetOrderStatus, string> = {
  draft: 'Draft',
  validated: 'Validated',
  assigned: 'Assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function fleetOrderStatusBadgeClass(status: FleetOrderStatus): string {
  switch (status) {
    case 'draft':
      return dashStatusChip('neutral');
    case 'validated':
      return dashStatusChip('info');
    case 'assigned':
    case 'in_progress':
      return dashStatusChip('warning');
    case 'completed':
      return dashStatusChip('success');
    case 'cancelled':
      return dashStatusChip('danger');
    default:
      return dashStatusChip('neutral');
  }
}
