import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';

export const dynamic = 'force-dynamic';

/** Kenya HGV driving time guidance: flag sessions exceeding 9 hours driving. */
const MAX_DRIVING_MINUTES = 9 * 60;

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const driverId = ctx.request.nextUrl.searchParams.get('driverId');

    const logs = await prisma.fleetDrivingTimeLog.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
        ...(driverId ? { driverId } : {}),
      },
      include: {
        driver: { select: { fullName: true } },
        vehicle: { select: { registration: true } },
        trip: { select: { tripNumber: true } },
      },
      orderBy: [{ sessionStart: 'desc' }],
      take: 100,
    });

    const violations = logs.filter((l) => l.exceedsLimit || l.drivingMinutes > MAX_DRIVING_MINUTES);

    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        driverName: l.driver.fullName,
        vehicleRegistration: l.vehicle?.registration ?? null,
        tripNumber: l.trip?.tripNumber ?? null,
        sessionStart: l.sessionStart.toISOString(),
        sessionEnd: l.sessionEnd?.toISOString() ?? null,
        drivingMinutes: l.drivingMinutes,
        restMinutes: l.restMinutes,
        exceedsLimit: l.exceedsLimit || l.drivingMinutes > MAX_DRIVING_MINUTES,
      })),
      violationCount: violations.length,
      maxDrivingMinutes: MAX_DRIVING_MINUTES,
    });
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json()) as {
      driverId?: string;
      vehicleId?: string;
      tripId?: string;
      sessionStart?: string;
      sessionEnd?: string;
      drivingMinutes?: number;
      restMinutes?: number;
    };

    if (!body.driverId || !body.sessionStart) {
      return NextResponse.json({ error: 'driverId and sessionStart are required.' }, { status: 400 });
    }

    const drivingMinutes = body.drivingMinutes ?? 0;
    const exceedsLimit = drivingMinutes > MAX_DRIVING_MINUTES;

    const log = await prisma.fleetDrivingTimeLog.create({
      data: {
        organizationId: ctx.organizationId,
        outsourcingClientId: ctx.workspaceClientId,
        driverId: body.driverId,
        vehicleId: body.vehicleId || null,
        tripId: body.tripId || null,
        sessionStart: new Date(body.sessionStart),
        sessionEnd: body.sessionEnd ? new Date(body.sessionEnd) : null,
        drivingMinutes,
        restMinutes: body.restMinutes ?? 0,
        exceedsLimit,
      },
    });

    return NextResponse.json({ id: log.id, exceedsLimit }, { status: 201 });
  });
}
