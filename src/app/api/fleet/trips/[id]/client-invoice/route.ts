import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import { createFleetClientInvoice } from '@/lib/fleet-billing';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withFleetTenant(request, async (ctx) => {
    const { id } = await params;

    const trip = await prisma.fleetTrip.findFirst({
      where: fleetTenantWhere(ctx, { id }),
      include: { customer: { select: { name: true, contactEmail: true } } },
    });

    if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (trip.clientInvoiceId) {
      return NextResponse.json({ error: 'Trip already has a client invoice.' }, { status: 409 });
    }
    if (!['delivered', 'settled'].includes(trip.status)) {
      return NextResponse.json(
        { error: 'Only delivered or settled trips can be invoiced.' },
        { status: 400 },
      );
    }

    try {
      const invoice = await createFleetClientInvoice(prisma, {
        tripId: trip.id,
        customerId: trip.customerId,
        organizationId: ctx.organizationId,
        outsourcingClientId: ctx.workspaceClientId,
        tripNumber: trip.tripNumber,
        customerName: trip.customer.name,
        customerContactEmail: trip.customer.contactEmail,
        origin: trip.origin,
        destination: trip.destination,
        plannedDistanceKm: trip.plannedDistanceKm,
        cargoWeightKg: trip.cargoWeightKg,
        cargoType: trip.cargoType,
      });

      const fullTrip = await prisma.fleetTrip.findFirst({
        where: { id },
        include: fleetTripDetailInclude,
      });

      return NextResponse.json({
        invoice,
        trip: fullTrip ? tripToDetail(fullTrip) : null,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to create invoice.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
