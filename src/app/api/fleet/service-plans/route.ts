import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const status = ctx.request.nextUrl.searchParams.get('status');

    const plans = await prisma.fleetServicePlan.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        vehicle: { select: { registration: true, label: true } },
      },
      orderBy: [{ dueAt: 'asc' }],
      take: 200,
    });

    return NextResponse.json(
      plans.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        vehicleRegistration: p.vehicle.registration,
        vehicleLabel: p.vehicle.label,
        dueAt: p.dueAt.toISOString(),
        dueOdometerKm: p.dueOdometerKm,
        status: p.status,
        completedAt: p.completedAt?.toISOString() ?? null,
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json()) as {
      vehicleId?: string;
      title?: string;
      description?: string;
      dueAt?: string;
      dueOdometerKm?: number;
    };

    if (!body.vehicleId || !body.title?.trim() || !body.dueAt) {
      return NextResponse.json(
        { error: 'vehicleId, title, and dueAt are required.' },
        { status: 400 },
      );
    }

    const plan = await prisma.fleetServicePlan.create({
      data: {
        organizationId: ctx.organizationId,
        outsourcingClientId: ctx.workspaceClientId,
        vehicleId: body.vehicleId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        dueAt: new Date(body.dueAt),
        dueOdometerKm: body.dueOdometerKm ?? null,
      },
      include: { vehicle: { select: { registration: true } } },
    });

    return NextResponse.json(
      { id: plan.id, title: plan.title, vehicleRegistration: plan.vehicle.registration },
      { status: 201 },
    );
  });
}
