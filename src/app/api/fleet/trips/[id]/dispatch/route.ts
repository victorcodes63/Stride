import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import { dispatchFleetTrip } from '@/lib/fleet-dispatch';
import { TripStatusTransitionError } from '@/lib/fleet-trip-status-change';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withFleetTenant(request, async (ctx) => {
    const { id } = await params;

    const trip = await prisma.fleetTrip.findFirst({
      where: fleetTenantWhere(ctx, { id }),
      select: { id: true, status: true },
    });
    if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (trip.status !== 'loaded') {
      return NextResponse.json(
        { error: 'Trip must be loaded before dispatch.' },
        { status: 400 },
      );
    }

    try {
      const updated = await prisma.$transaction((tx) =>
        dispatchFleetTrip(tx, {
          tripId: id,
          organizationId: ctx.organizationId,
          actorEmail: ctx.staff.email,
          actorUserId: ctx.staff.id,
        }),
      );
      return NextResponse.json(tripToDetail(updated));
    } catch (e) {
      if (e instanceof TripStatusTransitionError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
  });
}
