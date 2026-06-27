import { NextRequest, NextResponse } from 'next/server';
import type { FleetDefectSeverity } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const status = ctx.request.nextUrl.searchParams.get('status');

    const defects = await prisma.fleetDefectReport.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        vehicle: { select: { registration: true, label: true } },
        reportedByDriver: { select: { fullName: true } },
      },
      orderBy: [{ reportedAt: 'desc' }],
      take: 200,
    });

    return NextResponse.json(
      defects.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        severity: d.severity,
        status: d.status,
        vehicleRegistration: d.vehicle.registration,
        driverName: d.reportedByDriver?.fullName ?? null,
        reportedAt: d.reportedAt.toISOString(),
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json()) as {
      vehicleId?: string;
      tripId?: string;
      reportedByDriverId?: string;
      title?: string;
      description?: string;
      severity?: FleetDefectSeverity;
    };

    if (!body.vehicleId || !body.title?.trim() || !body.description?.trim()) {
      return NextResponse.json(
        { error: 'vehicleId, title, and description are required.' },
        { status: 400 },
      );
    }

    const defect = await prisma.fleetDefectReport.create({
      data: {
        organizationId: ctx.organizationId,
        outsourcingClientId: ctx.workspaceClientId,
        vehicleId: body.vehicleId,
        tripId: body.tripId || null,
        reportedByDriverId: body.reportedByDriverId || null,
        title: body.title.trim(),
        description: body.description.trim(),
        severity: body.severity ?? 'minor',
      },
    });

    return NextResponse.json({ id: defect.id, title: defect.title }, { status: 201 });
  });
}
