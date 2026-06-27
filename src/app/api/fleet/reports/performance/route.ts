import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant } from '@/lib/fleet-tenant-api';

export const dynamic = 'force-dynamic';

const ESCALATION_HOURS = 24;

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const periodDays = parseInt(ctx.request.nextUrl.searchParams.get('days') ?? '30', 10);
    const format = ctx.request.nextUrl.searchParams.get('format');
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [
      tripStats,
      vehicleStats,
      settlementStats,
      fuelAgg,
      orderStats,
      deliveredTrips,
      partnerSettlements,
      openIncidents,
    ] = await Promise.all([
      prisma.fleetTrip.groupBy({
        by: ['status'],
        where: {
          outsourcingClientId: ctx.workspaceClientId,
          organizationId: ctx.organizationId,
          createdAt: { gte: since },
        },
        _count: { _all: true },
      }),
      prisma.fleetVehicle.groupBy({
        by: ['status'],
        where: {
          outsourcingClientId: ctx.workspaceClientId,
          organizationId: ctx.organizationId,
        },
        _count: { _all: true },
      }),
      prisma.fleetSettlement.groupBy({
        by: ['status'],
        where: {
          outsourcingClientId: ctx.workspaceClientId,
          organizationId: ctx.organizationId,
          createdAt: { gte: since },
        },
        _count: { _all: true },
        _sum: { amountKes: true },
      }),
      prisma.fleetFuelLog.aggregate({
        where: {
          outsourcingClientId: ctx.workspaceClientId,
          organizationId: ctx.organizationId,
          fueledAt: { gte: since },
        },
        _sum: { liters: true, amountKes: true },
      }),
      prisma.fleetOrder.groupBy({
        by: ['status'],
        where: {
          outsourcingClientId: ctx.workspaceClientId,
          organizationId: ctx.organizationId,
          createdAt: { gte: since },
        },
        _count: { _all: true },
      }),
      prisma.fleetTrip.findMany({
        where: {
          outsourcingClientId: ctx.workspaceClientId,
          organizationId: ctx.organizationId,
          status: { in: ['delivered', 'settled', 'invoiced', 'closed'] },
          actualDeliveryAt: { not: null },
          plannedDeliveryAt: { not: null },
          createdAt: { gte: since },
        },
        select: {
          actualDeliveryAt: true,
          plannedDeliveryAt: true,
        },
      }),
      prisma.fleetSettlement.groupBy({
        by: ['payeeName', 'settlementType'],
        where: {
          outsourcingClientId: ctx.workspaceClientId,
          organizationId: ctx.organizationId,
          settlementType: 'partner',
          createdAt: { gte: since },
        },
        _count: { _all: true },
        _sum: { amountKes: true },
      }),
      prisma.fleetIncident.count({
        where: {
          outsourcingClientId: ctx.workspaceClientId,
          organizationId: ctx.organizationId,
          status: { in: ['open', 'investigating'] },
          severity: 'high',
          reportedAt: { lt: new Date(Date.now() - ESCALATION_HOURS * 60 * 60 * 1000) },
        },
      }),
    ]);

    const delivered = tripStats
      .filter((t) => ['delivered', 'settled', 'invoiced', 'closed'].includes(t.status))
      .reduce((s, t) => s + t._count._all, 0);

    const onTimeCount = deliveredTrips.filter((t) => {
      if (!t.actualDeliveryAt || !t.plannedDeliveryAt) return false;
      return t.actualDeliveryAt.getTime() <= t.plannedDeliveryAt.getTime();
    }).length;

    const onTimePct =
      deliveredTrips.length > 0
        ? Math.round((onTimeCount / deliveredTrips.length) * 100)
        : 0;

    const totalTrips = tripStats.reduce((s, t) => s + t._count._all, 0);
    const utilization =
      vehicleStats.find((v) => v.status === 'in_transit')?._count._all ?? 0;
    const fleetTotal = vehicleStats.reduce((s, v) => s + v._count._all, 0);

    const payload = {
      periodDays,
      trips: {
        total: totalTrips,
        delivered,
        byStatus: Object.fromEntries(tripStats.map((t) => [t.status, t._count._all])),
        onTimeDeliveries: onTimeCount,
        onTimePct,
      },
      fleet: {
        total: fleetTotal,
        inTransit: utilization,
        utilizationPct: fleetTotal > 0 ? Math.round((utilization / fleetTotal) * 100) : 0,
        byStatus: Object.fromEntries(vehicleStats.map((v) => [v.status, v._count._all])),
      },
      orders: {
        byStatus: Object.fromEntries(orderStats.map((o) => [o.status, o._count._all])),
      },
      settlements: {
        byStatus: Object.fromEntries(settlementStats.map((s) => [s.status, s._count._all])),
        totalAmountKes: settlementStats.reduce(
          (sum, s) => sum + (s._sum.amountKes ? Number(s._sum.amountKes) : 0),
          0,
        ),
      },
      fuel: {
        liters: fuelAgg._sum.liters ? Number(fuelAgg._sum.liters) : 0,
        spendKes: fuelAgg._sum.amountKes ? Number(fuelAgg._sum.amountKes) : 0,
      },
      transporterScorecard: partnerSettlements.map((p) => ({
        payeeName: p.payeeName,
        tripCount: p._count._all,
        totalPaidKes: p._sum.amountKes ? Number(p._sum.amountKes) : 0,
      })),
      incidents: {
        escalatedHighSeverity: openIncidents,
      },
    };

    if (format === 'csv') {
      const lines = [
        'metric,value',
        `period_days,${periodDays}`,
        `trips_total,${totalTrips}`,
        `trips_delivered,${delivered}`,
        `on_time_pct,${onTimePct}`,
        `fleet_utilization_pct,${payload.fleet.utilizationPct}`,
        `fuel_spend_kes,${payload.fuel.spendKes}`,
        `settlements_total_kes,${payload.settlements.totalAmountKes}`,
      ];
      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="fleet-performance-${periodDays}d.csv"`,
        },
      });
    }

    return NextResponse.json(payload);
  });
}
