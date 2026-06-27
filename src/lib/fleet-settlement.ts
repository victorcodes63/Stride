import type { FleetSettlementStatus, FleetSettlementType } from '@prisma/client';
import { dashStatusChip } from '@/lib/dashboard-status-chips';

export const FLEET_SETTLEMENT_STATUS_LABELS: Record<FleetSettlementStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  paid: 'Paid',
};

export const FLEET_SETTLEMENT_TYPE_LABELS: Record<FleetSettlementType, string> = {
  driver: 'Driver mileage & expenses',
  partner: 'Transporter payment',
};

export function fleetSettlementStatusBadgeClass(status: FleetSettlementStatus): string {
  switch (status) {
    case 'paid':
      return dashStatusChip('success');
    case 'approved':
      return dashStatusChip('info');
    default:
      return dashStatusChip('warning');
  }
}

/** Demo freight estimate (ex-VAT) from distance and weight. */
export function estimateTripFreightExVatKes(input: {
  plannedDistanceKm: number | null;
  cargoWeightKg: number | null;
}): number {
  const km = input.plannedDistanceKm ?? 100;
  const weight = input.cargoWeightKg ?? 0;
  return Math.round(km * 85 + weight * 0.5);
}

export function estimateDriverSettlementKes(plannedDistanceKm: number | null): number {
  const km = plannedDistanceKm ?? 100;
  return Math.round(km * 12 + 2500);
}

export function estimatePartnerSettlementKes(plannedDistanceKm: number | null): number {
  const km = plannedDistanceKm ?? 100;
  return Math.round(km * 55 + 8000);
}
