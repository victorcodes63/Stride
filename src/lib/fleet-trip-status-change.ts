import type { FleetTripStatus, Prisma } from '@prisma/client';
import {
  canTransitionTripStatus,
  FLEET_TRIP_STATUS_LABELS,
  type FleetTripStatusActor,
} from '@/lib/fleet-status';
import { fleetTripDetailInclude } from '@/lib/fleet-api';
import { tripHasRoutePlan, tripPlanningGateError } from '@/lib/fleet-planning';
import { assertTripStatusGates } from '@/lib/fleet-credential-gate';

export type ApplyTripStatusChangeInput = {
  tripId: string;
  from: FleetTripStatus;
  to: FleetTripStatus;
  actor: FleetTripStatusActor;
  actorEmail?: string;
  source?: string;
  note?: string;
  setActualDeliveryAt?: boolean;
};

export function tripStatusTransitionError(from: FleetTripStatus, to: FleetTripStatus): string {
  return `Cannot change trip status from ${FLEET_TRIP_STATUS_LABELS[from]} to ${FLEET_TRIP_STATUS_LABELS[to]}.`;
}

export async function applyTripStatusChange(
  tx: Prisma.TransactionClient,
  input: ApplyTripStatusChangeInput,
) {
  const { tripId, from, to, actor, actorEmail, source, note, setActualDeliveryAt } = input;

  if (!canTransitionTripStatus(from, to, actor)) {
    throw new TripStatusTransitionError(tripStatusTransitionError(from, to));
  }

  const existing = await tx.fleetTrip.findUnique({
    where: { id: tripId },
    select: {
      status: true,
      actualDeliveryAt: true,
      vehicleId: true,
      tripNumber: true,
      plannedDistanceKm: true,
      plannedDeliveryAt: true,
    },
  });
  if (!existing) {
    throw new TripStatusTransitionError('Trip not found.');
  }
  if (existing.status !== from) {
    throw new TripStatusTransitionError(
      `Trip status is ${FLEET_TRIP_STATUS_LABELS[existing.status]}, expected ${FLEET_TRIP_STATUS_LABELS[from]}.`,
    );
  }

  if (to === 'loaded') {
    const routeEvent = await tx.fleetTripEvent.findFirst({
      where: { tripId, eventType: 'route_planned' },
      select: { id: true },
    });
    if (
      !tripHasRoutePlan({
        plannedDistanceKm: existing.plannedDistanceKm,
        plannedDeliveryAt: existing.plannedDeliveryAt,
        hasRoutePlannedEvent: Boolean(routeEvent),
      })
    ) {
      throw new TripStatusTransitionError(tripPlanningGateError(existing));
    }
    await assertTripStatusGates(tx, tripId, to, actor);
  }

  if (to === 'in_transit' || to === 'delivered') {
    await assertTripStatusGates(tx, tripId, to, actor);
  }

  const shouldSetDelivery =
    setActualDeliveryAt ?? (to === 'delivered' && !existing.actualDeliveryAt);

  const updated = await tx.fleetTrip.update({
    where: { id: tripId },
    data: {
      status: to,
      ...(shouldSetDelivery ? { actualDeliveryAt: new Date() } : {}),
    },
    include: fleetTripDetailInclude,
  });

  const message = note
    ? `Status updated to ${FLEET_TRIP_STATUS_LABELS[to]}: ${note}`
    : `Status updated to ${FLEET_TRIP_STATUS_LABELS[to]}.`;

  await tx.fleetTripEvent.create({
    data: {
      tripId,
      eventType: 'status_change',
      message,
      metadata: {
        from,
        to,
        ...(actorEmail ? { actorEmail } : {}),
        ...(source ? { source } : {}),
      },
    },
  });

  if (updated.vehicleId && (to === 'in_transit' || to === 'delivered' || to === 'closed')) {
    await tx.fleetVehicle.update({
      where: { id: updated.vehicleId },
      data: {
        status: to === 'in_transit' ? 'in_transit' : 'available',
      },
    });
  }

  return updated;
}

export class TripStatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TripStatusTransitionError';
  }
}
