import type { FleetSettlementStatus, FleetSettlementType } from '@prisma/client';

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
      return 'bg-emerald-50 text-emerald-800';
    case 'approved':
      return 'bg-sky-50 text-sky-800';
    default:
      return 'bg-amber-50 text-amber-800';
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
