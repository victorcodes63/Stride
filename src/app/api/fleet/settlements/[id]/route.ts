import { NextRequest, NextResponse } from 'next/server';
import type { FleetSettlementStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import {
  FLEET_SETTLEMENT_STATUS_LABELS,
  FLEET_SETTLEMENT_TYPE_LABELS,
} from '@/lib/fleet-settlement';
import { postFleetSettlementVendorBill } from '@/lib/finance-posting';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const STATUSES: FleetSettlementStatus[] = ['pending', 'approved', 'paid'];

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
  const body = (await request.json().catch(() => null)) as {
    status?: string;
    podVerified?: boolean;
  } | null;

  const nextStatus = body?.status as FleetSettlementStatus | undefined;
  if (nextStatus && !STATUSES.includes(nextStatus)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const existing = await prisma.fleetSettlement.findFirst({
    where: { id, outsourcingClientId: workspaceClientId },
    include: { trip: { select: { id: true, tripNumber: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const podVerified =
    body?.podVerified !== undefined ? Boolean(body.podVerified) : existing.podVerified;

  if (
    nextStatus === 'approved' &&
    existing.settlementType === 'partner' &&
    !podVerified
  ) {
    return NextResponse.json(
      { error: 'Partner settlements require verified POD before approval.' },
      { status: 400 },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.fleetSettlement.update({
      where: { id },
      data: {
        ...(nextStatus ? { status: nextStatus } : {}),
        podVerified,
        ...(nextStatus === 'approved' ? { approvedAt: new Date() } : {}),
        ...(nextStatus === 'paid' ? { paidAt: new Date(), status: 'paid' } : {}),
      },
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
    });

    if (nextStatus) {
      await tx.fleetTripEvent.create({
        data: {
          tripId: row.tripId,
          eventType: 'settlement',
          message: `Settlement ${FLEET_SETTLEMENT_STATUS_LABELS[nextStatus].toLowerCase()} for ${row.payeeName}.`,
          metadata: { settlementId: id, status: nextStatus, actorEmail: user.email },
        },
      });

      if (nextStatus === 'paid' && row.trip.status === 'delivered') {
        await tx.fleetTrip.update({
          where: { id: row.tripId },
          data: { status: 'settled' },
        });
      }

      if (nextStatus === 'paid' && existing.status !== 'paid') {
        const tripLabel = `${row.trip.tripNumber}: ${row.trip.origin} → ${row.trip.destination}`;
        const bill = await postFleetSettlementVendorBill(tx, row, tripLabel);
        if (bill) {
          await tx.fleetTripEvent.create({
            data: {
              tripId: row.tripId,
              eventType: 'settlement',
              message: `Vendor bill posted for ${row.payeeName}.`,
              metadata: { settlementId: id, vendorBillId: bill.billId },
            },
          });
        }
      }
    }

    return row;
  });

  return NextResponse.json({
    id: updated.id,
    tripId: updated.tripId,
    tripNumber: updated.trip.tripNumber,
    route: `${updated.trip.origin} → ${updated.trip.destination}`,
    customerName: updated.trip.customer.name,
    settlementType: updated.settlementType,
    settlementTypeLabel: FLEET_SETTLEMENT_TYPE_LABELS[updated.settlementType],
    payeeName: updated.payeeName,
    amountKes: Number(updated.amountKes),
    status: updated.status,
    statusLabel: FLEET_SETTLEMENT_STATUS_LABELS[updated.status],
    podVerified: updated.podVerified,
    notes: updated.notes,
    approvedAt: updated.approvedAt?.toISOString() ?? null,
    paidAt: updated.paidAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
}
