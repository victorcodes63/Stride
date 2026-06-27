import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import { verifyFleetPod } from '@/lib/fleet-dispatch';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withFleetTenant(request, async (ctx) => {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      documentId?: string;
      approved?: boolean;
      rejectionReason?: string;
    } | null;

    const documentId = body?.documentId?.trim();
    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required.' }, { status: 400 });
    }

    const trip = await prisma.fleetTrip.findFirst({
      where: fleetTenantWhere(ctx, { id }),
    });
    if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    try {
      await verifyFleetPod(prisma, {
        tripId: id,
        documentId,
        organizationId: ctx.organizationId,
        approved: body?.approved !== false,
        actorUserId: ctx.staff.id,
        actorEmail: ctx.staff.email,
        rejectionReason: body?.rejectionReason,
      });

      const full = await prisma.fleetTrip.findFirst({
        where: { id },
        include: fleetTripDetailInclude,
      });
      return NextResponse.json(full ? tripToDetail(full) : null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to validate POD.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
