import type { FleetTripStatus, PrismaClient } from '@prisma/client';

export const DRIVER_ACTIVE_TRIP_STATUSES: FleetTripStatus[] = [
  'allocated',
  'compliance_check',
  'loaded',
  'in_transit',
  'exception',
];

/** Status transitions a driver may set from the ESS mobile app. */
export const DRIVER_TRIP_STATUS_TRANSITIONS: Partial<Record<FleetTripStatus, FleetTripStatus[]>> = {
  compliance_check: ['loaded'],
  loaded: ['in_transit'],
  in_transit: ['delivered'],
  exception: ['in_transit', 'delivered'],
};

export function driverCanSetTripStatus(current: FleetTripStatus, next: FleetTripStatus): boolean {
  return DRIVER_TRIP_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
}

export async function getFleetDriverForEmployee(prisma: PrismaClient, employeeId: string) {
  return prisma.fleetDriver.findUnique({
    where: { employeeId },
    select: {
      id: true,
      organizationId: true,
      outsourcingClientId: true,
      fullName: true,
      status: true,
    },
  });
}
