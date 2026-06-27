import { NextRequest, NextResponse } from 'next/server';
import type { FleetVehicleOwnership, FleetVehicleStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const vehicles = await prisma.fleetVehicle.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
      },
      orderBy: [{ status: 'asc' }, { registration: 'asc' }],
    });

    return NextResponse.json(
      vehicles.map((v) => ({
        id: v.id,
        registration: v.registration,
        label: v.label,
        vehicleType: v.vehicleType,
        ownership: v.ownership,
        status: v.status,
        depotLocation: v.depotLocation,
        capacityKg: v.capacityKg,
        odometerKm: v.odometerKm,
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json()) as {
      registration?: string;
      label?: string;
      vehicleType?: string;
      capacityKg?: number;
      ownership?: FleetVehicleOwnership;
      status?: FleetVehicleStatus;
      depotLocation?: string;
      odometerKm?: number;
      notes?: string;
    };

    if (!body.registration?.trim()) {
      return NextResponse.json({ error: 'Registration is required.' }, { status: 400 });
    }

    const vehicle = await prisma.fleetVehicle.create({
      data: {
        organizationId: ctx.organizationId,
        outsourcingClientId: ctx.workspaceClientId,
        registration: body.registration.trim().toUpperCase(),
        label: body.label?.trim() || null,
        vehicleType: body.vehicleType?.trim() || null,
        capacityKg: body.capacityKg ?? null,
        ownership: body.ownership ?? 'managed',
        status: body.status ?? 'available',
        depotLocation: body.depotLocation?.trim() || null,
        odometerKm: body.odometerKm ?? null,
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        id: vehicle.id,
        registration: vehicle.registration,
        label: vehicle.label,
        vehicleType: vehicle.vehicleType,
        ownership: vehicle.ownership,
        status: vehicle.status,
        depotLocation: vehicle.depotLocation,
        capacityKg: vehicle.capacityKg,
        odometerKm: vehicle.odometerKm,
      },
      { status: 201 },
    );
  });
}
