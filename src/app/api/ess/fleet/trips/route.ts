import { NextRequest, NextResponse } from 'next/server';
import { DRIVER_ACTIVE_TRIP_STATUSES, getFleetDriverForEmployee } from '@/lib/ess-fleet';
import { fleetTripInclude, tripToListRow } from '@/lib/fleet-api';
import { withEssTenant } from '@/lib/ess-tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) {
      return NextResponse.json({ driver: null, trips: [] });
    }

    const driver = await ctx.run((tx) => getFleetDriverForEmployee(tx, ctx.employeeId!));
    if (!driver) {
      return NextResponse.json({ driver: null, trips: [] });
    }

    const trips = await ctx.run((tx) =>
      tx.fleetTrip.findMany({
        where: ctx.where({
          driverId: driver.id,
          outsourcingClientId: driver.outsourcingClientId,
          status: { in: DRIVER_ACTIVE_TRIP_STATUSES },
        }),
        include: fleetTripInclude,
        orderBy: [{ plannedDeliveryAt: 'asc' }, { updatedAt: 'desc' }],
        take: 30,
      }),
    );

    return NextResponse.json({
      driver: { id: driver.id, fullName: driver.fullName },
      trips: trips.map(tripToListRow),
    });
  });
}
