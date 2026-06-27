import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const customers = await prisma.fleetCustomer.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
      },
      orderBy: { name: 'asc' },
      include: { _count: { select: { orders: true, trips: true } } },
    });

    return NextResponse.json(
      customers.map((c) => ({
        id: c.id,
        name: c.name,
        contactName: c.contactName,
        contactPhone: c.contactPhone,
        contactEmail: c.contactEmail,
        billingTerms: c.billingTerms,
        orderCount: c._count.orders,
        tripCount: c._count.trips,
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json()) as {
      name?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
      billingTerms?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Customer name is required.' }, { status: 400 });
    }

    const customer = await prisma.fleetCustomer.create({
      data: {
        organizationId: ctx.organizationId,
        outsourcingClientId: ctx.workspaceClientId,
        name: body.name.trim(),
        contactName: body.contactName?.trim() || null,
        contactPhone: body.contactPhone?.trim() || null,
        contactEmail: body.contactEmail?.trim() || null,
        billingTerms: body.billingTerms?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        id: customer.id,
        name: customer.name,
        contactName: customer.contactName,
        contactPhone: customer.contactPhone,
        contactEmail: customer.contactEmail,
        billingTerms: customer.billingTerms,
        orderCount: 0,
        tripCount: 0,
      },
      { status: 201 },
    );
  });
}
