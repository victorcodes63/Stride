import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';
import { estimateTripEta } from '@/lib/fleet-eta';

export const dynamic = 'force-dynamic';

/** In-transit board with ETA for active trips. */
export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const trips = await prisma.fleetTrip.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
        status: 'in_transit',
      },
      include: {
        customer: { select: { name: true } },
        driver: { select: { fullName: true, phone: true } },
        vehicle: {
          select: {
            registration: true,
            positions: {
              orderBy: { recordedAt: 'desc' },
              take: 1,
              select: { speedKph: true, recordedAt: true },
            },
          },
        },
        documents: {
          where: { docType: 'pod' },
          select: { id: true, verifiedAt: true },
        },
      },
      orderBy: { plannedDeliveryAt: 'asc' },
    });

    return NextResponse.json(
      trips.map((trip) => {
        const position = trip.vehicle?.positions[0] ?? null;
        const eta = estimateTripEta({
          plannedDeliveryAt: trip.plannedDeliveryAt,
          plannedDistanceKm: trip.plannedDistanceKm,
          actualDistanceKm: trip.actualDistanceKm,
          speedKph: position?.speedKph ? Number(position.speedKph) : null,
          recordedAt: position?.recordedAt ?? null,
        });

        return {
          id: trip.id,
          tripNumber: trip.tripNumber,
          origin: trip.origin,
          destination: trip.destination,
          customerName: trip.customer.name,
          driverName: trip.driver?.fullName ?? null,
          driverPhone: trip.driver?.phone ?? null,
          vehicleRegistration: trip.vehicle?.registration ?? null,
          plannedDeliveryAt: trip.plannedDeliveryAt?.toISOString() ?? null,
          etaAt: eta?.toISOString() ?? null,
          hasPod: trip.documents.length > 0,
          podVerified: trip.documents.some((d) => d.verifiedAt != null),
          lastPositionAt: position?.recordedAt.toISOString() ?? null,
        };
      }),
    );
  });
}
