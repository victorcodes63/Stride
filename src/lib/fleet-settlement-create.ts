import type { PrismaClient } from '@prisma/client';
import {
  estimateDriverSettlementKes,
  estimatePartnerSettlementKes,
} from '@/lib/fleet-settlement';
import { tripHasVerifiedPod } from '@/lib/fleet-credential-gate';

export class FleetSettlementCreateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FleetSettlementCreateError';
  }
}

export async function createFleetSettlementForTrip(
  prisma: PrismaClient,
  input: {
    tripId: string;
    organizationId: string;
    outsourcingClientId: string;
  },
) {
  const trip = await prisma.fleetTrip.findFirst({
    where: {
      id: input.tripId,
      organizationId: input.organizationId,
      outsourcingClientId: input.outsourcingClientId,
    },
    include: {
      driver: { select: { fullName: true } },
      partner: { select: { name: true } },
      settlement: { select: { id: true } },
    },
  });

  if (!trip) throw new FleetSettlementCreateError('Trip not found.');
  if (trip.settlement) {
    throw new FleetSettlementCreateError('Settlement already exists for this trip.');
  }
  if (!['delivered', 'settled'].includes(trip.status)) {
    throw new FleetSettlementCreateError(
      'Settlements can only be created for delivered or settled trips.',
    );
  }

  const podVerified = await tripHasVerifiedPod(prisma, trip.id);
  const settlementType = trip.isOutsourced && trip.partnerId ? 'partner' : 'driver';
  const payeeName =
    settlementType === 'partner'
      ? (trip.partner?.name ?? 'Transporter')
      : (trip.driver?.fullName ?? 'Driver');

  const amountKes =
    settlementType === 'partner'
      ? estimatePartnerSettlementKes(trip.plannedDistanceKm)
      : estimateDriverSettlementKes(trip.plannedDistanceKm);

  const row = await prisma.$transaction(async (tx) => {
    const settlement = await tx.fleetSettlement.create({
      data: {
        organizationId: input.organizationId,
        outsourcingClientId: input.outsourcingClientId,
        tripId: trip.id,
        settlementType,
        payeeName,
        amountKes,
        podVerified,
        notes:
          settlementType === 'partner' && !podVerified
            ? 'Awaiting verified POD before partner approval.'
            : null,
      },
    });

    await tx.fleetTripEvent.create({
      data: {
        organizationId: input.organizationId,
        tripId: trip.id,
        eventType: 'settlement',
        message: `${settlementType === 'partner' ? 'Partner' : 'Driver'} settlement created for ${payeeName}.`,
        metadata: {
          settlementId: settlement.id,
          amountKes,
          podVerified,
        },
      },
    });

    return settlement;
  });

  return row;
}
