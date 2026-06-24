import type { FleetComplianceCheckType, FleetComplianceResult, PrismaClient } from '@prisma/client';

export const FLEET_COMPLIANCE_CHECK_TYPES: FleetComplianceCheckType[] = [
  'driver_licence',
  'vehicle_insurance',
  'vehicle_inspection',
  'cargo_documents',
  'transport_permit_local',
  'transport_permit_transit',
];

export const FLEET_COMPLIANCE_CHECK_LABELS: Record<FleetComplianceCheckType, string> = {
  driver_licence: 'Driver licence valid',
  vehicle_insurance: 'Vehicle insurance valid',
  vehicle_inspection: 'Vehicle inspection passed',
  cargo_documents: 'Cargo documents complete',
  transport_permit_local: 'Local transport permit',
  transport_permit_transit: 'Transit permit (cross-border)',
};

export const FLEET_COMPLIANCE_RESULT_LABELS: Record<FleetComplianceResult, string> = {
  pending: 'Pending',
  passed: 'Passed',
  failed: 'Failed',
  waived: 'Waived',
};

export function fleetComplianceResultBadgeClass(result: FleetComplianceResult): string {
  switch (result) {
    case 'passed':
    case 'waived':
      return 'bg-emerald-50 text-emerald-800';
    case 'failed':
      return 'bg-red-50 text-red-800';
    default:
      return 'bg-amber-50 text-amber-800';
  }
}

export function isFleetComplianceComplete(
  checks: { result: FleetComplianceResult }[],
): boolean {
  if (checks.length === 0) return false;
  return checks.every((c) => c.result === 'passed' || c.result === 'waived');
}

/** Ensure all standard pre-trip checks exist for a trip. */
export async function ensureTripComplianceChecks(
  prisma: PrismaClient,
  tripId: string,
) {
  const existing = await prisma.fleetTripComplianceCheck.findMany({
    where: { tripId },
    select: { checkType: true },
  });
  const have = new Set(existing.map((c) => c.checkType));
  const missing = FLEET_COMPLIANCE_CHECK_TYPES.filter((t) => !have.has(t));
  if (missing.length === 0) return;

  await prisma.fleetTripComplianceCheck.createMany({
    data: missing.map((checkType) => ({ tripId, checkType })),
  });
}
