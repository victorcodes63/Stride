import { NextRequest, NextResponse } from 'next/server';
import type { FleetTripStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';
import { fleetTripInclude, tripToListRow } from '@/lib/fleet-api';
import { nextFleetTripNumber } from '@/lib/fleet-numbers';
import { ensureTripComplianceChecks } from '@/lib/fleet-compliance';
import { FLEET_TRIP_STATUSES } from '@/lib/fleet-status';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const statusRaw = ctx.request.nextUrl.searchParams.get('status');
    const status =
      statusRaw && FLEET_TRIP_STATUSES.includes(statusRaw as FleetTripStatus)
        ? (statusRaw as FleetTripStatus)
        : undefined;

    const trips = await prisma.fleetTrip.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
        ...(status ? { status } : {}),
      },
      include: fleetTripInclude,
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
    });

    return NextResponse.json(trips.map(tripToListRow));
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json()) as {
      customerId?: string;
      origin?: string;
      destination?: string;
      cargoType?: string;
      cargoWeightKg?: number;
      vehicleId?: string;
      driverId?: string;
      partnerId?: string;
      isOutsourced?: boolean;
      plannedDistanceKm?: number;
      plannedDeliveryAt?: string;
      orderId?: string;
      notes?: string;
    };

    if (!body.customerId?.trim()) {
      return NextResponse.json({ error: 'Customer is required.' }, { status: 400 });
    }
    if (!body.origin?.trim() || !body.destination?.trim()) {
      return NextResponse.json({ error: 'Origin and destination are required.' }, { status: 400 });
    }

    const customer = await prisma.fleetCustomer.findFirst({
      where: {
        id: body.customerId,
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
      },
    });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    }

    const tripNumber = await nextFleetTripNumber(prisma, ctx.workspaceClientId);
    const hasAllocation = Boolean(body.vehicleId || body.driverId || body.partnerId);

    const trip = await prisma.fleetTrip.create({
      data: {
        organizationId: ctx.organizationId,
        outsourcingClientId: ctx.workspaceClientId,
        tripNumber,
        orderId: body.orderId || null,
        customerId: body.customerId,
        origin: body.origin.trim(),
        destination: body.destination.trim(),
        cargoType: body.cargoType?.trim() || null,
        cargoWeightKg: body.cargoWeightKg ?? null,
        vehicleId: body.vehicleId || null,
        driverId: body.driverId || null,
        partnerId: body.partnerId || null,
        isOutsourced: body.isOutsourced ?? Boolean(body.partnerId),
        plannedDistanceKm: body.plannedDistanceKm ?? null,
        plannedDeliveryAt: body.plannedDeliveryAt ? new Date(body.plannedDeliveryAt) : null,
        notes: body.notes?.trim() || null,
        status: hasAllocation ? 'allocated' : 'planned',
      },
      include: fleetTripInclude,
    });

    await ensureTripComplianceChecks(prisma, trip.id);

    return NextResponse.json(tripToListRow(trip), { status: 201 });
  });
}
