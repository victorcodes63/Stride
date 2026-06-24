import { NextRequest, NextResponse } from 'next/server';
import type { FleetTripStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import { FLEET_TRIP_STATUSES, FLEET_TRIP_STATUS_LABELS } from '@/lib/fleet-status';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessFleet(user)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  const nextStatus = body?.status;

  if (!nextStatus || !FLEET_TRIP_STATUSES.includes(nextStatus as FleetTripStatus)) {
    return NextResponse.json({ error: 'Invalid trip status.' }, { status: 400 });
  }

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const existing = await prisma.fleetTrip.findFirst({
    where: { id, outsourcingClientId: workspaceClientId },
  });

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.status === nextStatus) {
    const trip = await prisma.fleetTrip.findFirst({
      where: { id },
      include: fleetTripDetailInclude,
    });
    return NextResponse.json(trip ? tripToDetail(trip) : null);
  }

  const status = nextStatus as FleetTripStatus;
  const trip = await prisma.$transaction(async (tx) => {
    const updated = await tx.fleetTrip.update({
      where: { id },
      data: {
        status,
        ...(status === 'delivered' && !existing.actualDeliveryAt
          ? { actualDeliveryAt: new Date() }
          : {}),
      },
      include: fleetTripDetailInclude,
    });

    await tx.fleetTripEvent.create({
      data: {
        tripId: id,
        eventType: 'status_change',
        message: `Status updated to ${FLEET_TRIP_STATUS_LABELS[status]}.`,
        metadata: { from: existing.status, to: status, actorEmail: user.email },
      },
    });

    if (updated.vehicleId && (status === 'in_transit' || status === 'closed')) {
      await tx.fleetVehicle.update({
        where: { id: updated.vehicleId },
        data: {
          status: status === 'in_transit' ? 'in_transit' : 'available',
        },
      });
    }

    return updated;
  });

  return NextResponse.json(tripToDetail(trip));
}
