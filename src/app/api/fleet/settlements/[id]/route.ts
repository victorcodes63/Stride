import { NextRequest, NextResponse } from 'next/server';
import type { FleetSettlementStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import {
  FLEET_SETTLEMENT_STATUS_LABELS,
  FLEET_SETTLEMENT_TYPE_LABELS,
} from '@/lib/fleet-settlement';
import { postFleetSettlementVendorBill } from '@/lib/finance-posting';
import {
  applyTripStatusChange,
  TripStatusTransitionError,
} from '@/lib/fleet-trip-status-change';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const STATUSES: FleetSettlementStatus[] = ['pending', 'approved', 'paid'];

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withFleetTenant(request, async (ctx) => {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      status?: string;
      podVerified?: boolean;
    } | null;

    const nextStatus = body?.status as FleetSettlementStatus | undefined;
    if (nextStatus && !STATUSES.includes(nextStatus)) {
      return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
    }

    const existing = await prisma.fleetSettlement.findFirst({
      where: fleetTenantWhere(ctx, { id }),
      include: { trip: { select: { id: true, tripNumber: true, status: true, origin: true, destination: true, isOutsourced: true, customer: { select: { name: true } } } } },
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

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
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
            metadata: { settlementId: id, status: nextStatus, actorEmail: ctx.staff.email },
          },
        });

        if (nextStatus === 'paid' && row.trip.status === 'delivered') {
          await applyTripStatusChange(tx, {
            tripId: row.tripId,
            from: 'delivered',
            to: 'settled',
            actor: 'staff',
            actorEmail: ctx.staff.email,
            source: 'settlement',
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
    } catch (e) {
      if (e instanceof TripStatusTransitionError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

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
  });
}
