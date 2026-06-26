import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import { ensureTripComplianceChecks } from '@/lib/fleet-compliance';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withFleetTenant(request, async (ctx) => {
    const { id } = await params;

    const trip = await prisma.fleetTrip.findFirst({
      where: fleetTenantWhere(ctx, { id }),
    });

    if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await ensureTripComplianceChecks(prisma, id);

    const fullTrip = await prisma.fleetTrip.findFirst({
      where: { id },
      include: fleetTripDetailInclude,
    });

    if (!fullTrip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(tripToDetail(fullTrip));
  });
}
