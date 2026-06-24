import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import { createFleetClientInvoice } from '@/lib/fleet-billing';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessFleet(user)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { id } = await params;
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const trip = await prisma.fleetTrip.findFirst({
    where: { id, outsourcingClientId: workspaceClientId },
    include: { customer: { select: { name: true } } },
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
      outsourcingClientId: workspaceClientId,
      tripNumber: trip.tripNumber,
      customerName: trip.customer.name,
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
}
