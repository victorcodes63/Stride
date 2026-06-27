import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import { ensureTripComplianceChecks } from '@/lib/fleet-compliance';
import { syncDriverLicenceComplianceCheck } from '@/lib/fleet-credential-gate';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withFleetTenant(request, async (ctx) => {
    const { id } = await params;

    const trip = await prisma.fleetTrip.findFirst({
      where: fleetTenantWhere(ctx, { id }),
      select: { id: true, driverId: true },
    });

    if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await ensureTripComplianceChecks(prisma, id);

    if (trip.driverId) {
      await prisma.$transaction((tx) =>
        syncDriverLicenceComplianceCheck(tx, id, trip.driverId),
      );
    }

    const fullTrip = await prisma.fleetTrip.findFirst({
      where: { id },
      include: fleetTripDetailInclude,
    });

    if (!fullTrip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(tripToDetail(fullTrip));
  });
}
