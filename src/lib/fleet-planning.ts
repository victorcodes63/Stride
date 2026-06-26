import type { FleetTrip } from '@prisma/client';

export type FleetRoutePlan = {
  distanceKm: number;
  fuelLitersEstimate: number;
  transitHoursEstimate: number;
  estimatedArrival: string;
};

export function parseRoutePlanMetadata(metadata: unknown): FleetRoutePlan | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  if (typeof m.distanceKm !== 'number') return null;
  if (typeof m.fuelLitersEstimate !== 'number') return null;
  if (typeof m.transitHoursEstimate !== 'number') return null;
  if (typeof m.estimatedArrival !== 'string') return null;
  return {
    distanceKm: m.distanceKm,
    fuelLitersEstimate: m.fuelLitersEstimate,
    transitHoursEstimate: m.transitHoursEstimate,
    estimatedArrival: m.estimatedArrival,
  };
}

export function tripHasRoutePlan(input: {
  plannedDistanceKm: number | null;
  plannedDeliveryAt: Date | null;
  hasRoutePlannedEvent: boolean;
}): boolean {
  return Boolean(
    input.plannedDistanceKm != null &&
      input.plannedDistanceKm > 0 &&
      input.plannedDeliveryAt &&
      input.hasRoutePlannedEvent,
  );
}

export function tripPlanningGateError(trip: Pick<FleetTrip, 'tripNumber'>): string {
  return `Trip ${trip.tripNumber} needs a saved route plan (distance, fuel, transit time, ETA) before dispatch. Use Route planning and apply to this trip.`;
}
