import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { DRIVER_ACTIVE_TRIP_STATUSES, getFleetDriverForEmployee } from '@/lib/ess-fleet';
import { fleetTripInclude, tripToListRow } from '@/lib/fleet-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) {
    return NextResponse.json({ driver: null, trips: [] });
  }

  const driver = await getFleetDriverForEmployee(prisma, user.employeeId);
  if (!driver) {
    return NextResponse.json({ driver: null, trips: [] });
  }

  const trips = await prisma.fleetTrip.findMany({
    where: {
      driverId: driver.id,
      outsourcingClientId: driver.outsourcingClientId,
      status: { in: DRIVER_ACTIVE_TRIP_STATUSES },
    },
    include: fleetTripInclude,
    orderBy: [{ plannedDeliveryAt: 'asc' }, { updatedAt: 'desc' }],
    take: 30,
  });

  return NextResponse.json({
    driver: { id: driver.id, fullName: driver.fullName },
    trips: trips.map(tripToListRow),
  });
}
