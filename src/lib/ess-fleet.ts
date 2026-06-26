import type { FleetTripStatus, PrismaClient } from '@prisma/client';
import { canTransitionTripStatus } from '@/lib/fleet-status';

export const DRIVER_ACTIVE_TRIP_STATUSES: FleetTripStatus[] = [
  'allocated',
  'compliance_check',
  'loaded',
  'in_transit',
  'exception',
];

export function driverCanSetTripStatus(current: FleetTripStatus, next: FleetTripStatus): boolean {
  return canTransitionTripStatus(current, next, 'driver');
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
