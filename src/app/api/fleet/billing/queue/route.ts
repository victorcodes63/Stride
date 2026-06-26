import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import { estimateTripFreightExVatKes } from '@/lib/fleet-settlement';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const trips = await prisma.fleetTrip.findMany({
      where: fleetTenantWhere(ctx, {
        status: { in: ['delivered', 'settled'] },
        clientInvoiceId: null,
      }),
      include: {
        customer: { select: { name: true } },
        documents: { where: { docType: 'pod' }, select: { id: true } },
      },
      orderBy: { actualDeliveryAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(
      trips.map((trip) => ({
        id: trip.id,
        tripNumber: trip.tripNumber,
        status: trip.status,
        origin: trip.origin,
        destination: trip.destination,
        customerName: trip.customer.name,
        hasPod: trip.documents.length > 0,
        estimatedFreightExVat: estimateTripFreightExVatKes({
          plannedDistanceKm: trip.plannedDistanceKm,
          cargoWeightKg: trip.cargoWeightKg,
        }),
        actualDeliveryAt: trip.actualDeliveryAt?.toISOString() ?? null,
      })),
    );
  });
}
