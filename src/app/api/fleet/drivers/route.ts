import { NextRequest, NextResponse } from 'next/server';
import type { FleetDriverStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import { FLEET_DRIVER_STATUS_LABELS } from '@/lib/fleet/registers';

export const dynamic = 'force-dynamic';

const DRIVER_STATUSES = new Set<FleetDriverStatus>([
  'available',
  'on_trip',
  'off_duty',
  'suspended',
]);

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const rows = await prisma.fleetDriver.findMany({
      where: fleetTenantWhere(ctx),
      include: {
        employee: { select: { id: true, name: true, email: true } },
        _count: { select: { trips: true } },
      },
      orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
    });

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        phone: row.phone,
        licenceNumber: row.licenceNumber,
        licenceClass: row.licenceClass,
        licenceExpiry: row.licenceExpiry?.toISOString().slice(0, 10) ?? null,
        status: row.status,
        statusLabel: FLEET_DRIVER_STATUS_LABELS[row.status],
        employeeName: row.employee?.name ?? null,
        tripCount: row._count.trips,
        notes: row.notes,
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
    if (!fullName) {
      return NextResponse.json({ error: 'fullName is required.' }, { status: 400 });
    }

    const status = (body?.status ?? 'available') as FleetDriverStatus;
    if (!DRIVER_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid driver status.' }, { status: 400 });
    }

    const licenceExpiry =
      typeof body?.licenceExpiry === 'string' && body.licenceExpiry
        ? new Date(body.licenceExpiry)
        : null;

    const row = await prisma.fleetDriver.create({
      data: {
        organizationId: ctx.organizationId,
        outsourcingClientId: ctx.workspaceClientId,
        fullName,
        phone: typeof body?.phone === 'string' ? body.phone.trim() || null : null,
        licenceNumber:
          typeof body?.licenceNumber === 'string' ? body.licenceNumber.trim() || null : null,
        licenceClass:
          typeof body?.licenceClass === 'string' ? body.licenceClass.trim() || null : null,
        licenceExpiry,
        status,
        notes: typeof body?.notes === 'string' ? body.notes.trim() || null : null,
      },
    });

    return NextResponse.json(
      {
        id: row.id,
        fullName: row.fullName,
        status: row.status,
        statusLabel: FLEET_DRIVER_STATUS_LABELS[row.status],
      },
      { status: 201 },
    );
  });
}
