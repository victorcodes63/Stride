import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import { FLEET_TRIP_STATUSES } from '@/lib/fleet-status';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        vehicles: { total: 0, available: 0, inTransit: 0, maintenance: 0 },
        trips: { total: 0, active: 0, delivered: 0, exception: 0 },
        settlements: { pending: 0 },
        incidents: { open: 0 },
        byStatus: {},
      });
    }

    try {
      const scope = fleetTenantWhere(ctx);

      const [vehicles, trips, settlements, incidents] = await Promise.all([
        prisma.fleetVehicle.groupBy({
          by: ['status'],
          where: scope,
          _count: { _all: true },
        }),
        prisma.fleetTrip.groupBy({
          by: ['status'],
          where: scope,
          _count: { _all: true },
        }),
        prisma.fleetSettlement.count({
          where: { ...scope, status: 'pending' },
        }),
        prisma.fleetIncident.count({
          where: {
            ...scope,
            status: { in: ['open', 'investigating'] },
          },
        }),
      ]);

      const vehicleCounts = Object.fromEntries(vehicles.map((v) => [v.status, v._count._all]));
      const tripCounts = Object.fromEntries(trips.map((t) => [t.status, t._count._all]));
      const tripTotal = trips.reduce((sum, t) => sum + t._count._all, 0);

      const activeStatuses = new Set([
        'allocated',
        'compliance_check',
        'loaded',
        'in_transit',
      ]);

      return NextResponse.json({
        vehicles: {
          total: Object.values(vehicleCounts).reduce((a, b) => a + b, 0),
          available: vehicleCounts.available ?? 0,
          inTransit: vehicleCounts.in_transit ?? 0,
          maintenance: vehicleCounts.maintenance ?? 0,
        },
        trips: {
          total: tripTotal,
          active: trips
            .filter((t) => activeStatuses.has(t.status))
            .reduce((sum, t) => sum + t._count._all, 0),
          delivered: tripCounts.delivered ?? 0,
          exception: tripCounts.exception ?? 0,
        },
        settlements: { pending: settlements },
        incidents: { open: incidents },
        byStatus: FLEET_TRIP_STATUSES.reduce(
          (acc, status) => {
            acc[status] = tripCounts[status] ?? 0;
            return acc;
          },
          {} as Record<string, number>,
        ),
      });
    } catch (error) {
      console.error('GET /api/fleet/overview failed:', error);
      return NextResponse.json(
        {
          error:
            'Fleet data is unavailable. Run `npx prisma generate` and restart the dev server after schema changes.',
        },
        { status: 500 },
      );
    }
  });
}
