import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import { estimateFuelLiters, estimateTransitHours } from '@/lib/fleet-numbers';
import type { FleetRoutePlan } from '@/lib/fleet-planning';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

function estimateDistance(origin: string, destination: string): number {
  const key = `${origin.toLowerCase().trim()}|${destination.toLowerCase().trim()}`;
  const routes: Record<string, number> = {
    'nairobi|mombasa': 480,
    'mombasa|nairobi': 480,
    'nairobi|kisumu': 350,
    'kisumu|nairobi': 350,
    'nairobi|eldoret': 310,
    'eldoret|nairobi': 310,
    'nairobi|nakuru': 160,
    'nakuru|nairobi': 160,
  };
  for (const [route, km] of Object.entries(routes)) {
    const [a, b] = route.split('|');
    if (key.includes(a!) && key.includes(b!)) return km;
  }
  return 500;
}

/** POST /api/fleet/trips/[id]/planning — persist route + fuel/transit/ETA estimates on a trip. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withFleetTenant(request, async (ctx) => {
    const { id } = await params;
    const body = (await request.json()) as {
      distanceKm?: number;
      vehicleType?: string;
      isCrossBorder?: boolean;
      deliveryDeadline?: string;
    };

    const trip = await prisma.fleetTrip.findFirst({
      where: fleetTenantWhere(ctx, { id }),
    });
    if (!trip) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });

    const distanceKm = body.distanceKm ?? trip.plannedDistanceKm ?? estimateDistance(trip.origin, trip.destination);
    const fuelLitersEstimate = estimateFuelLiters(distanceKm, body.vehicleType);
    const transitHoursEstimate = estimateTransitHours(distanceKm, body.isCrossBorder);
    const estimatedArrival = new Date(Date.now() + transitHoursEstimate * 60 * 60 * 1000);
    const plannedDeliveryAt = body.deliveryDeadline
      ? new Date(body.deliveryDeadline)
      : trip.plannedDeliveryAt ?? estimatedArrival;

    const plan: FleetRoutePlan = {
      distanceKm,
      fuelLitersEstimate,
      transitHoursEstimate,
      estimatedArrival: estimatedArrival.toISOString(),
    };

    await prisma.$transaction(async (tx) => {
      await tx.fleetTrip.update({
        where: { id: trip.id },
        data: {
          plannedDistanceKm: distanceKm,
          plannedDeliveryAt,
        },
      });

      await tx.fleetTripEvent.create({
        data: {
          organizationId: ctx.organizationId,
          tripId: trip.id,
          eventType: 'route_planned',
          message: `Route planned: ${distanceKm} km, ~${fuelLitersEstimate} L fuel, ~${transitHoursEstimate} hrs transit.`,
          metadata: plan,
        },
      });
    });

    return NextResponse.json({
      tripId: trip.id,
      origin: trip.origin,
      destination: trip.destination,
      ...plan,
      plannedDeliveryAt: plannedDeliveryAt.toISOString(),
    });
  });
}
