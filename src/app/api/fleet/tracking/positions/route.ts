import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';

export const dynamic = 'force-dynamic';

/** Latest position per vehicle + active trip context for live map. */
export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const vehicles = await prisma.fleetVehicle.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
        status: { in: ['available', 'in_transit'] },
      },
      select: {
        id: true,
        registration: true,
        label: true,
        status: true,
        depotLocation: true,
        trips: {
          where: { status: { in: ['loaded', 'in_transit'] } },
          take: 1,
          select: {
            id: true,
            tripNumber: true,
            origin: true,
            destination: true,
            driver: { select: { fullName: true } },
          },
        },
        positions: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
          select: {
            latitude: true,
            longitude: true,
            speedKph: true,
            headingDeg: true,
            recordedAt: true,
          },
        },
      },
    });

    return NextResponse.json(
      vehicles.map((v) => ({
        vehicleId: v.id,
        registration: v.registration,
        label: v.label,
        status: v.status,
        depotLocation: v.depotLocation,
        activeTrip: v.trips[0] ?? null,
        position: v.positions[0]
          ? {
              latitude: Number(v.positions[0].latitude),
              longitude: Number(v.positions[0].longitude),
              speedKph: v.positions[0].speedKph ? Number(v.positions[0].speedKph) : null,
              headingDeg: v.positions[0].headingDeg,
              recordedAt: v.positions[0].recordedAt.toISOString(),
            }
          : null,
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json()) as {
      vehicleId?: string;
      tripId?: string;
      latitude?: number;
      longitude?: number;
      speedKph?: number;
      headingDeg?: number;
    };

    if (!body.vehicleId || body.latitude == null || body.longitude == null) {
      return NextResponse.json(
        { error: 'vehicleId, latitude, and longitude are required.' },
        { status: 400 },
      );
    }

    const position = await prisma.fleetVehiclePosition.create({
      data: {
        organizationId: ctx.organizationId,
        vehicleId: body.vehicleId,
        tripId: body.tripId || null,
        latitude: body.latitude,
        longitude: body.longitude,
        speedKph: body.speedKph ?? null,
        headingDeg: body.headingDeg ?? null,
      },
    });

    return NextResponse.json(
      {
        id: position.id,
        recordedAt: position.recordedAt.toISOString(),
      },
      { status: 201 },
    );
  });
}
