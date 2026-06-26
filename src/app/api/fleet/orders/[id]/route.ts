import { NextRequest, NextResponse } from 'next/server';
import type { FleetOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';
import { orderToListRow } from '@/lib/fleet-orders-api';
import { nextFleetTripNumber } from '@/lib/fleet-numbers';
import { ensureTripComplianceChecks } from '@/lib/fleet-compliance';
import { FLEET_ORDER_STATUSES } from '@/lib/fleet-order-status';
import {
  assertFleetAllocationAvailable,
  FleetAllocationConflictError,
} from '@/lib/fleet-allocation';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withFleetTenant(request, async (ctx) => {
    const { id } = await params;
    const order = await prisma.fleetOrder.findFirst({
      where: {
        id,
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
      },
      include: {
        customer: { select: { id: true, name: true, contactPhone: true, billingTerms: true } },
        trips: {
          select: { id: true, tripNumber: true, status: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { trips: true } },
      },
    });
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      ...orderToListRow(order),
      customer: order.customer,
      trips: order.trips,
      notes: order.notes,
    });
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withFleetTenant(request, async (ctx) => {
    const { id } = await params;
    const body = (await request.json()) as {
      status?: FleetOrderStatus;
      action?: 'validate' | 'create_trip' | 'allocate';
      vehicleId?: string;
      driverId?: string;
      partnerId?: string;
      isOutsourced?: boolean;
      plannedDistanceKm?: number;
      plannedDeliveryAt?: string;
    };

    const order = await prisma.fleetOrder.findFirst({
      where: {
        id,
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
      },
      include: { customer: true },
    });
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (body.action === 'validate') {
      const updated = await prisma.fleetOrder.update({
        where: { id },
        data: { status: 'validated' },
        include: { customer: { select: { name: true } }, _count: { select: { trips: true } } },
      });
      return NextResponse.json(orderToListRow(updated));
    }

    const isAllocateAction = body.action === 'allocate' || body.action === 'create_trip';

    if (isAllocateAction) {
      if (order.status !== 'validated' && order.status !== 'assigned') {
        return NextResponse.json(
          { error: 'Order must be validated before allocation.' },
          { status: 400 },
        );
      }

      const allocation = {
        vehicleId: body.vehicleId || null,
        driverId: body.driverId || null,
        partnerId: body.partnerId || null,
        isOutsourced: body.isOutsourced ?? Boolean(body.partnerId),
      };

      try {
        await assertFleetAllocationAvailable(prisma, ctx, allocation);
      } catch (e) {
        if (e instanceof FleetAllocationConflictError) {
          return NextResponse.json({ error: e.message }, { status: 409 });
        }
        throw e;
      }

      const tripNumber = await nextFleetTripNumber(prisma, ctx.workspaceClientId);
      const plannedDeliveryAt =
        body.plannedDeliveryAt
          ? new Date(body.plannedDeliveryAt)
          : order.deliveryDeadlineAt ?? null;

      const trip = await prisma.fleetTrip.create({
        data: {
          organizationId: ctx.organizationId,
          outsourcingClientId: ctx.workspaceClientId,
          tripNumber,
          orderId: order.id,
          customerId: order.customerId,
          origin: order.pickupLocation,
          destination: order.deliveryLocation,
          cargoType: order.cargoType,
          cargoWeightKg: order.cargoWeightKg,
          vehicleId: allocation.vehicleId,
          driverId: allocation.driverId,
          partnerId: allocation.partnerId,
          isOutsourced: allocation.isOutsourced,
          plannedDistanceKm: body.plannedDistanceKm ?? null,
          plannedDeliveryAt,
          status: 'allocated',
        },
      });

      await ensureTripComplianceChecks(prisma, trip.id);

      if (allocation.driverId) {
        await prisma.fleetDriver.update({
          where: { id: allocation.driverId },
          data: { status: 'on_trip' },
        });
      }

      await prisma.fleetOrder.update({
        where: { id },
        data: { status: 'assigned' },
      });

      await prisma.fleetTripEvent.create({
        data: {
          tripId: trip.id,
          eventType: 'order_assigned',
          message: `Trip ${tripNumber} allocated from order ${order.orderNumber}.`,
          metadata: {
            orderId: order.id,
            vehicleId: allocation.vehicleId,
            driverId: allocation.driverId,
            partnerId: allocation.partnerId,
            isOutsourced: allocation.isOutsourced,
          },
        },
      });

      return NextResponse.json({ tripId: trip.id, tripNumber: trip.tripNumber, status: 'allocated' }, { status: 201 });
    }

    if (body.status && FLEET_ORDER_STATUSES.includes(body.status)) {
      const updated = await prisma.fleetOrder.update({
        where: { id },
        data: { status: body.status },
        include: { customer: { select: { name: true } }, _count: { select: { trips: true } } },
      });
      return NextResponse.json(orderToListRow(updated));
    }

    return NextResponse.json({ error: 'No valid update.' }, { status: 400 });
  });
}
