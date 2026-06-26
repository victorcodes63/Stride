import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';
import { estimateFuelLiters, estimateTransitHours } from '@/lib/fleet-numbers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json()) as {
      origin?: string;
      destination?: string;
      distanceKm?: number;
      vehicleType?: string;
      isCrossBorder?: boolean;
      deliveryDeadline?: string;
    };

    if (!body.origin?.trim() || !body.destination?.trim()) {
      return NextResponse.json({ error: 'Origin and destination are required.' }, { status: 400 });
    }

    const distanceKm = body.distanceKm ?? estimateDistance(body.origin, body.destination);
    const fuelLiters = estimateFuelLiters(distanceKm, body.vehicleType);
    const transitHours = estimateTransitHours(distanceKm, body.isCrossBorder);
    const eta = new Date(Date.now() + transitHours * 60 * 60 * 1000);

    const availableVehicles = await prisma.fleetVehicle.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
        status: 'available',
      },
      select: {
        id: true,
        registration: true,
        label: true,
        vehicleType: true,
        capacityKg: true,
        depotLocation: true,
      },
      take: 10,
    });

    const availableDrivers = await prisma.fleetDriver.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
        status: 'available',
      },
      select: { id: true, fullName: true, licenceClass: true },
      take: 10,
    });

    return NextResponse.json({
      origin: body.origin.trim(),
      destination: body.destination.trim(),
      distanceKm,
      fuelLitersEstimate: fuelLiters,
      transitHoursEstimate: transitHours,
      estimatedArrival: eta.toISOString(),
      deliveryDeadline: body.deliveryDeadline ?? null,
      meetsDeadline: body.deliveryDeadline ? eta <= new Date(body.deliveryDeadline) : null,
      suggestedVehicles: availableVehicles,
      suggestedDrivers: availableDrivers,
    });
  });
}

/** Rough corridor distances for common Kenya routes (km). Falls back to 500km default. */
function estimateDistance(origin: string, destination: string): number {
  const key = `${origin.toLowerCase().trim()}|${destination.toLowerCase().trim()}`;
  const routes: Record<string, number> = {
    'nairobi|mombasa': 480,
    'mombasa|nairobi': 480,
    'nairobi|kisumu': 350,
    'kisumu|nairobi': 350,
    'nairobi|eldoret': 310,
    'eldoret|nairobi': 310,
    'nairobi|nakuru': 160,
    'nakuru|nairobi': 160,
    'nairobi|malaba': 520,
    'malaba|nairobi': 520,
    'mombasa|malindi': 120,
    'nairobi|namanga': 180,
  };
  for (const [route, km] of Object.entries(routes)) {
    const [a, b] = route.split('|');
    if (key.includes(a!) && key.includes(b!)) return km;
  }
  return 500;
}
