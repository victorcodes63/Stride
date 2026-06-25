import { NextRequest, NextResponse } from 'next/server';
import type { FleetTripStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import {
  driverCanSetTripStatus,
  getFleetDriverForEmployee,
} from '@/lib/ess-fleet';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import { FLEET_TRIP_STATUS_LABELS } from '@/lib/fleet-status';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) {
    return NextResponse.json({ error: 'No linked employee profile.' }, { status: 400 });
  }

  const driver = await getFleetDriverForEmployee(prisma, user.employeeId);
  if (!driver) {
    return NextResponse.json({ error: 'You are not registered as a fleet driver.' }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: string; note?: string } | null;
  const nextStatus = body?.status as FleetTripStatus | undefined;
  const note = typeof body?.note === 'string' ? body.note.trim() : '';

  if (!nextStatus) {
    return NextResponse.json({ error: 'Status is required.' }, { status: 400 });
  }

  const existing = await prisma.fleetTrip.findFirst({
    where: {
      id,
      driverId: driver.id,
      outsourcingClientId: driver.outsourcingClientId,
    },
  });

  if (!existing) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
  if (!driverCanSetTripStatus(existing.status, nextStatus)) {
    return NextResponse.json({ error: 'That status change is not allowed.' }, { status: 400 });
  }

  const trip = await prisma.$transaction(async (tx) => {
    const updated = await tx.fleetTrip.update({
      where: { id },
      data: {
        status: nextStatus,
        ...(nextStatus === 'delivered' && !existing.actualDeliveryAt
          ? { actualDeliveryAt: new Date() }
          : {}),
      },
      include: fleetTripDetailInclude,
    });

    const message = note
      ? `Driver updated status to ${FLEET_TRIP_STATUS_LABELS[nextStatus]}: ${note}`
      : `Driver updated status to ${FLEET_TRIP_STATUS_LABELS[nextStatus]}.`;

    await tx.fleetTripEvent.create({
      data: {
        tripId: id,
        eventType: 'status_change',
        message,
        metadata: {
          from: existing.status,
          to: nextStatus,
          actorEmail: user.email,
          source: 'ess',
        },
      },
    });

    if (updated.vehicleId && (nextStatus === 'in_transit' || nextStatus === 'delivered')) {
      await tx.fleetVehicle.update({
        where: { id: updated.vehicleId },
        data: {
          status: nextStatus === 'in_transit' ? 'in_transit' : 'available',
        },
      });
    }

    return updated;
  });

  return NextResponse.json(tripToDetail(trip));
}
