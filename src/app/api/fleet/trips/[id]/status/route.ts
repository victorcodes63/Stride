import { NextRequest, NextResponse } from 'next/server';
import type { FleetTripStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import { FLEET_TRIP_STATUSES } from '@/lib/fleet-status';
import {
  applyTripStatusChange,
  TripStatusTransitionError,
} from '@/lib/fleet-trip-status-change';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withFleetTenant(request, async (ctx) => {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as { status?: string } | null;
    const nextStatus = body?.status;

    if (!nextStatus || !FLEET_TRIP_STATUSES.includes(nextStatus as FleetTripStatus)) {
      return NextResponse.json({ error: 'Invalid trip status.' }, { status: 400 });
    }

    const status = nextStatus as FleetTripStatus;
    const existing = await prisma.fleetTrip.findFirst({
      where: fleetTenantWhere(ctx, { id }),
    });

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status === status) {
      const trip = await prisma.fleetTrip.findFirst({
        where: { id },
        include: fleetTripDetailInclude,
      });
      return NextResponse.json(trip ? tripToDetail(trip) : null);
    }

    try {
      const trip = await prisma.$transaction((tx) =>
        applyTripStatusChange(tx, {
          tripId: id,
          from: existing.status,
          to: status,
          actor: 'staff',
          actorEmail: ctx.staff.email,
          source: 'dashboard',
        }),
      );
      return NextResponse.json(tripToDetail(trip));
    } catch (e) {
      if (e instanceof TripStatusTransitionError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
  });
}
