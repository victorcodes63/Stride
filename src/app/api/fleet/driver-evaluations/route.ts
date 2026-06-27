import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const driverId = ctx.request.nextUrl.searchParams.get('driverId');

    const evaluations = await prisma.fleetDriverEvaluation.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
        ...(driverId ? { driverId } : {}),
      },
      include: {
        driver: { select: { fullName: true } },
        trip: { select: { tripNumber: true } },
      },
      orderBy: [{ evaluatedAt: 'desc' }],
      take: 100,
    });

    const avgByDriver = await prisma.fleetDriverEvaluation.groupBy({
      by: ['driverId'],
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
      },
      _avg: { scoreOverall: true, scoreSafety: true, scorePunctuality: true },
      _count: { _all: true },
    });

    const drivers = await prisma.fleetDriver.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
      },
      select: { id: true, fullName: true, employeeId: true },
    });

    const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d.fullName]));

    return NextResponse.json({
      evaluations: evaluations.map((e) => ({
        id: e.id,
        driverName: e.driver.fullName,
        tripNumber: e.trip?.tripNumber ?? null,
        period: e.period,
        scoreOverall: e.scoreOverall,
        scoreSafety: e.scoreSafety,
        scorePunctuality: e.scorePunctuality,
        scoreFuelEfficiency: e.scoreFuelEfficiency,
        scoreCustomer: e.scoreCustomer,
        evaluatedAt: e.evaluatedAt.toISOString(),
        notes: e.notes,
      })),
      driverSummaries: avgByDriver.map((row) => ({
        driverId: row.driverId,
        driverName: driverMap[row.driverId] ?? 'Unknown',
        avgOverall: row._avg.scoreOverall ? Math.round(row._avg.scoreOverall) : null,
        avgSafety: row._avg.scoreSafety ? Math.round(row._avg.scoreSafety) : null,
        evaluationCount: row._count._all,
      })),
    });
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json()) as {
      driverId?: string;
      tripId?: string;
      scoreOverall?: number;
      scoreSafety?: number;
      scorePunctuality?: number;
      scoreFuelEfficiency?: number;
      scoreCustomer?: number;
      notes?: string;
    };

    if (!body.driverId || body.scoreOverall == null) {
      return NextResponse.json({ error: 'driverId and scoreOverall are required.' }, { status: 400 });
    }

    const evaluation = await prisma.fleetDriverEvaluation.create({
      data: {
        organizationId: ctx.organizationId,
        outsourcingClientId: ctx.workspaceClientId,
        driverId: body.driverId,
        tripId: body.tripId || null,
        scoreOverall: Math.min(100, Math.max(0, body.scoreOverall)),
        scoreSafety: body.scoreSafety ?? null,
        scorePunctuality: body.scorePunctuality ?? null,
        scoreFuelEfficiency: body.scoreFuelEfficiency ?? null,
        scoreCustomer: body.scoreCustomer ?? null,
        notes: body.notes?.trim() || null,
        evaluatedByUserId: ctx.staff.id,
      },
    });

    return NextResponse.json({ id: evaluation.id }, { status: 201 });
  });
}
