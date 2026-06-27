import type { FleetTripStatus, PrismaClient } from '@prisma/client';
import {
  assertDriverEligibleForAllocation,
  FleetCredentialGateError,
} from '@/lib/fleet-credential-gate';

/** Trip statuses where vehicle/driver are considered committed (double-booking block). */
export const ACTIVE_ALLOCATION_TRIP_STATUSES: FleetTripStatus[] = [
  'allocated',
  'compliance_check',
  'loaded',
  'in_transit',
  'exception',
];

export type FleetAllocationInput = {
  vehicleId?: string | null;
  driverId?: string | null;
  partnerId?: string | null;
  isOutsourced?: boolean;
};

export class FleetAllocationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FleetAllocationConflictError';
  }
}

export async function assertFleetAllocationAvailable(
  prisma: PrismaClient,
  ctx: { organizationId: string; workspaceClientId: string },
  input: FleetAllocationInput,
  excludeTripId?: string,
) {
  const scope = {
    organizationId: ctx.organizationId,
    outsourcingClientId: ctx.workspaceClientId,
    status: { in: ACTIVE_ALLOCATION_TRIP_STATUSES },
    ...(excludeTripId ? { id: { not: excludeTripId } } : {}),
  };

  if (input.vehicleId) {
    const conflict = await prisma.fleetTrip.findFirst({
      where: { ...scope, vehicleId: input.vehicleId },
      select: { tripNumber: true, status: true },
    });
    if (conflict) {
      throw new FleetAllocationConflictError(
        `Vehicle is already assigned to trip ${conflict.tripNumber} (${conflict.status}).`,
      );
    }
  }

  if (input.driverId) {
    try {
      await assertDriverEligibleForAllocation(prisma, input.driverId);
    } catch (e) {
      if (e instanceof FleetCredentialGateError) {
        throw new FleetAllocationConflictError(e.message);
      }
      throw e;
    }

    const conflict = await prisma.fleetTrip.findFirst({
      where: { ...scope, driverId: input.driverId },
      select: { tripNumber: true, status: true },
    });
    if (conflict) {
      throw new FleetAllocationConflictError(
        `Driver is already assigned to trip ${conflict.tripNumber} (${conflict.status}).`,
      );
    }
  }

  const isOutsourced = input.isOutsourced ?? Boolean(input.partnerId);
  if (isOutsourced && !input.partnerId) {
    throw new FleetAllocationConflictError('Outsourced allocation requires a transport partner.');
  }
  if (!isOutsourced && input.partnerId && !input.vehicleId && !input.driverId) {
    throw new FleetAllocationConflictError(
      'Managed fleet allocation requires a vehicle or driver; use partner-only for outsourced trips.',
    );
  }
  if (!isOutsourced && !input.vehicleId && !input.driverId && !input.partnerId) {
    throw new FleetAllocationConflictError(
      'Allocation requires at least a vehicle, driver, or partner.',
    );
  }
}
