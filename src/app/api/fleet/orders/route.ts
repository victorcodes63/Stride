import { NextRequest, NextResponse } from 'next/server';
import type { FleetOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';
import { orderToListRow } from '@/lib/fleet-orders-api';
import { nextFleetOrderNumber } from '@/lib/fleet-numbers';
import { FLEET_ORDER_STATUSES } from '@/lib/fleet-order-status';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const statusRaw = ctx.request.nextUrl.searchParams.get('status');
    const status =
      statusRaw && FLEET_ORDER_STATUSES.includes(statusRaw as FleetOrderStatus)
        ? (statusRaw as FleetOrderStatus)
        : undefined;

    const orders = await prisma.fleetOrder.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
        ...(status ? { status } : {}),
      },
      include: {
        customer: { select: { name: true } },
        _count: { select: { trips: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
    });

    return NextResponse.json(orders.map(orderToListRow));
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json()) as {
      customerId?: string;
      pickupLocation?: string;
      deliveryLocation?: string;
      cargoType?: string;
      cargoWeightKg?: number;
      cargoVolumeCbm?: number;
      truckRequirements?: string;
      requestedPickupAt?: string;
      deliveryDeadlineAt?: string;
      notes?: string;
    };

    if (!body.customerId?.trim()) {
      return NextResponse.json({ error: 'Customer is required.' }, { status: 400 });
    }
    if (!body.pickupLocation?.trim() || !body.deliveryLocation?.trim()) {
      return NextResponse.json({ error: 'Pickup and delivery locations are required.' }, { status: 400 });
    }

    const customer = await prisma.fleetCustomer.findFirst({
      where: {
        id: body.customerId,
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
      },
    });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    }

    const orderNumber = await nextFleetOrderNumber(prisma, ctx.workspaceClientId);

    const order = await prisma.fleetOrder.create({
      data: {
        organizationId: ctx.organizationId,
        outsourcingClientId: ctx.workspaceClientId,
        customerId: body.customerId,
        orderNumber,
        pickupLocation: body.pickupLocation.trim(),
        deliveryLocation: body.deliveryLocation.trim(),
        cargoType: body.cargoType?.trim() || null,
        cargoWeightKg: body.cargoWeightKg ?? null,
        cargoVolumeCbm: body.cargoVolumeCbm ?? null,
        truckRequirements: body.truckRequirements?.trim() || null,
        requestedPickupAt: body.requestedPickupAt ? new Date(body.requestedPickupAt) : null,
        deliveryDeadlineAt: body.deliveryDeadlineAt ? new Date(body.deliveryDeadlineAt) : null,
        notes: body.notes?.trim() || null,
        status: 'draft',
      },
      include: {
        customer: { select: { name: true } },
        _count: { select: { trips: true } },
      },
    });

    return NextResponse.json(orderToListRow(order), { status: 201 });
  });
}
