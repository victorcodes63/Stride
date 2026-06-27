import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';

export const dynamic = 'force-dynamic';

/** CO₂ estimate: ~2.68 kg CO₂ per litre diesel (Kenya road freight approximation). */
const CO2_KG_PER_LITRE = 2.68;

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const snapshots = await prisma.fleetEnvironmentalSnapshot.findMany({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
      },
      include: {
        vehicle: { select: { registration: true } },
        trip: { select: { tripNumber: true } },
      },
      orderBy: [{ periodStart: 'desc' }],
      take: 50,
    });

    const fuelAgg = await prisma.fleetFuelLog.aggregate({
      where: {
        outsourcingClientId: ctx.workspaceClientId,
        organizationId: ctx.organizationId,
        fueledAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      _sum: { liters: true, amountKes: true },
      _count: { _all: true },
    });

    const totalLiters = fuelAgg._sum.liters ? Number(fuelAgg._sum.liters) : 0;
    const co2Estimate = Math.round(totalLiters * CO2_KG_PER_LITRE);

    return NextResponse.json({
      summary30d: {
        fuelLiters: totalLiters,
        fuelSpendKes: fuelAgg._sum.amountKes ? Number(fuelAgg._sum.amountKes) : 0,
        fillCount: fuelAgg._count._all,
        co2KgEstimate: co2Estimate,
      },
      snapshots: snapshots.map((s) => ({
        id: s.id,
        periodStart: s.periodStart.toISOString(),
        periodEnd: s.periodEnd.toISOString(),
        distanceKm: Number(s.distanceKm),
        fuelLiters: s.fuelLiters ? Number(s.fuelLiters) : null,
        co2KgEstimate: s.co2KgEstimate ? Number(s.co2KgEstimate) : null,
        idleMinutes: s.idleMinutes,
        vehicleRegistration: s.vehicle?.registration ?? null,
        tripNumber: s.trip?.tripNumber ?? null,
      })),
    });
  });
}
