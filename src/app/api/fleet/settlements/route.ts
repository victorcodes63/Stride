import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import {
  FLEET_SETTLEMENT_STATUS_LABELS,
  FLEET_SETTLEMENT_TYPE_LABELS,
} from '@/lib/fleet-settlement';
import {
  createFleetSettlementForTrip,
  FleetSettlementCreateError,
} from '@/lib/fleet-settlement-create';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const status = ctx.request.nextUrl.searchParams.get('status')?.trim();

    const rows = await prisma.fleetSettlement.findMany({
      where: fleetTenantWhere(ctx, { ...(status ? { status: status as never } : {}) }),
      include: {
        trip: {
          select: {
            id: true,
            tripNumber: true,
            origin: true,
            destination: true,
            status: true,
            isOutsourced: true,
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        tripId: row.tripId,
        tripNumber: row.trip.tripNumber,
        route: `${row.trip.origin} → ${row.trip.destination}`,
        customerName: row.trip.customer.name,
        settlementType: row.settlementType,
        settlementTypeLabel: FLEET_SETTLEMENT_TYPE_LABELS[row.settlementType],
        payeeName: row.payeeName,
        amountKes: Number(row.amountKes),
        status: row.status,
        statusLabel: FLEET_SETTLEMENT_STATUS_LABELS[row.status],
        podVerified: row.podVerified,
        notes: row.notes,
        approvedAt: row.approvedAt?.toISOString() ?? null,
        paidAt: row.paidAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json().catch(() => null)) as { tripId?: string } | null;
    const tripId = body?.tripId?.trim();
    if (!tripId) {
      return NextResponse.json({ error: 'tripId is required.' }, { status: 400 });
    }

    try {
      const row = await createFleetSettlementForTrip(prisma, {
        tripId,
        organizationId: ctx.organizationId,
        outsourcingClientId: ctx.workspaceClientId,
      });

      const trip = await prisma.fleetTrip.findUnique({
        where: { id: tripId },
        select: {
          tripNumber: true,
          origin: true,
          destination: true,
          status: true,
          isOutsourced: true,
          customer: { select: { name: true } },
        },
      });

      return NextResponse.json(
        {
          id: row.id,
          tripId: row.tripId,
          tripNumber: trip?.tripNumber ?? '',
          route: trip ? `${trip.origin} → ${trip.destination}` : '',
          customerName: trip?.customer.name ?? '',
          settlementType: row.settlementType,
          settlementTypeLabel: FLEET_SETTLEMENT_TYPE_LABELS[row.settlementType],
          payeeName: row.payeeName,
          amountKes: Number(row.amountKes),
          status: row.status,
          statusLabel: FLEET_SETTLEMENT_STATUS_LABELS[row.status],
          podVerified: row.podVerified,
          notes: row.notes,
          approvedAt: null,
          paidAt: null,
          createdAt: row.createdAt.toISOString(),
        },
        { status: 201 },
      );
    } catch (e) {
      if (e instanceof FleetSettlementCreateError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
  });
}
