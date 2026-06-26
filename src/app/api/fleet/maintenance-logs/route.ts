import { NextRequest, NextResponse } from 'next/server';
import type { FleetMaintenanceType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import {
  FLEET_MAINTENANCE_TYPE_LABELS,
  FLEET_MAINTENANCE_TYPES,
} from '@/lib/fleet/registers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const vehicleId = ctx.request.nextUrl.searchParams.get('vehicleId')?.trim() || undefined;

    const rows = await prisma.fleetMaintenanceLog.findMany({
      where: fleetTenantWhere(ctx, { ...(vehicleId ? { vehicleId } : {}) }),
      include: {
        vehicle: { select: { id: true, registration: true, label: true } },
      },
      orderBy: { performedAt: 'desc' },
      take: 200,
    });

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        vehicleId: row.vehicleId,
        vehicleRegistration: row.vehicle.registration,
        vehicleLabel: row.vehicle.label,
        maintenanceType: row.maintenanceType,
        maintenanceTypeLabel: FLEET_MAINTENANCE_TYPE_LABELS[row.maintenanceType],
        description: row.description,
        performedAt: row.performedAt.toISOString(),
        costKes: row.costKes != null ? Number(row.costKes) : null,
        odometerKm: row.odometerKm,
        vendor: row.vendor,
        notes: row.notes,
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const vehicleId = typeof body?.vehicleId === 'string' ? body.vehicleId.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const maintenanceType = (body?.maintenanceType ?? 'service') as FleetMaintenanceType;

    if (!vehicleId || !description) {
      return NextResponse.json({ error: 'vehicleId and description are required.' }, { status: 400 });
    }
    if (!FLEET_MAINTENANCE_TYPES.includes(maintenanceType)) {
      return NextResponse.json({ error: 'Invalid maintenance type.' }, { status: 400 });
    }

    const vehicle = await prisma.fleetVehicle.findFirst({
      where: fleetTenantWhere(ctx, { id: vehicleId }),
      select: { id: true },
    });
    if (!vehicle) return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });

    const performedAt =
      typeof body?.performedAt === 'string' && body.performedAt
        ? new Date(body.performedAt)
        : new Date();
    const costKes =
      body?.costKes != null && body.costKes !== '' ? Number(body.costKes) : null;
    const odometerKm =
      body?.odometerKm != null && body.odometerKm !== ''
        ? Number(body.odometerKm)
        : null;

    const row = await prisma.$transaction(async (tx) => {
      const log = await tx.fleetMaintenanceLog.create({
        data: {
          organizationId: ctx.organizationId,
          outsourcingClientId: ctx.workspaceClientId,
          vehicleId,
          maintenanceType,
          description,
          performedAt,
          costKes:
            costKes != null && Number.isFinite(costKes)
              ? new Prisma.Decimal(costKes)
              : null,
          odometerKm: Number.isFinite(odometerKm) ? odometerKm : null,
          vendor: typeof body?.vendor === 'string' ? body.vendor.trim() || null : null,
          notes: typeof body?.notes === 'string' ? body.notes.trim() || null : null,
          createdByUserId: ctx.staff.id,
        },
        include: { vehicle: { select: { registration: true } } },
      });

      const vehicleUpdate: { odometerKm?: number; status?: 'maintenance' } = {};
      if (Number.isFinite(odometerKm) && odometerKm != null) vehicleUpdate.odometerKm = odometerKm;
      if (maintenanceType === 'repair') vehicleUpdate.status = 'maintenance';
      if (Object.keys(vehicleUpdate).length > 0) {
        await tx.fleetVehicle.update({ where: { id: vehicleId }, data: vehicleUpdate });
      }

      return log;
    });

    return NextResponse.json(
      {
        id: row.id,
        vehicleRegistration: row.vehicle.registration,
        maintenanceTypeLabel: FLEET_MAINTENANCE_TYPE_LABELS[row.maintenanceType],
        performedAt: row.performedAt.toISOString(),
      },
      { status: 201 },
    );
  });
}
