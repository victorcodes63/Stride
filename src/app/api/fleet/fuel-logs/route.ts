import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessFleet(user)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }
  if (!process.env.DATABASE_URL) return NextResponse.json([]);

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const vehicleId = request.nextUrl.searchParams.get('vehicleId')?.trim() || undefined;

  const rows = await prisma.fleetFuelLog.findMany({
    where: {
      outsourcingClientId: workspaceClientId,
      ...(vehicleId ? { vehicleId } : {}),
    },
    include: {
      vehicle: { select: { id: true, registration: true, label: true } },
      driver: { select: { id: true, fullName: true } },
    },
    orderBy: { fueledAt: 'desc' },
    take: 200,
  });

  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      vehicleRegistration: row.vehicle.registration,
      vehicleLabel: row.vehicle.label,
      driverId: row.driverId,
      driverName: row.driver?.fullName ?? null,
      fueledAt: row.fueledAt.toISOString(),
      liters: Number(row.liters),
      amountKes: Number(row.amountKes),
      odometerKm: row.odometerKm,
      station: row.station,
      notes: row.notes,
    })),
  );
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessFleet(user)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const vehicleId = typeof body?.vehicleId === 'string' ? body.vehicleId.trim() : '';
  const liters = Number(body?.liters);
  const amountKes = Number(body?.amountKes);

  if (!vehicleId || !Number.isFinite(liters) || liters <= 0) {
    return NextResponse.json({ error: 'vehicleId and liters are required.' }, { status: 400 });
  }
  if (!Number.isFinite(amountKes) || amountKes < 0) {
    return NextResponse.json({ error: 'amountKes must be a valid number.' }, { status: 400 });
  }

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const vehicle = await prisma.fleetVehicle.findFirst({
    where: { id: vehicleId, outsourcingClientId: workspaceClientId },
    select: { id: true },
  });
  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });

  const driverId = typeof body?.driverId === 'string' ? body.driverId.trim() || null : null;
  if (driverId) {
    const driver = await prisma.fleetDriver.findFirst({
      where: { id: driverId, outsourcingClientId: workspaceClientId },
      select: { id: true },
    });
    if (!driver) return NextResponse.json({ error: 'Driver not found.' }, { status: 404 });
  }

  const fueledAt =
    typeof body?.fueledAt === 'string' && body.fueledAt
      ? new Date(body.fueledAt)
      : new Date();
  const odometerKm =
    body?.odometerKm != null && body.odometerKm !== ''
      ? Number(body.odometerKm)
      : null;

  const row = await prisma.$transaction(async (tx) => {
    const log = await tx.fleetFuelLog.create({
      data: {
        organizationId: user.currentOrgId,
        outsourcingClientId: workspaceClientId,
        vehicleId,
        driverId,
        fueledAt,
        liters: new Prisma.Decimal(liters),
        amountKes: new Prisma.Decimal(amountKes),
        odometerKm: Number.isFinite(odometerKm) ? odometerKm : null,
        station: typeof body?.station === 'string' ? body.station.trim() || null : null,
        notes: typeof body?.notes === 'string' ? body.notes.trim() || null : null,
        createdByUserId: user.id,
      },
      include: {
        vehicle: { select: { registration: true } },
        driver: { select: { fullName: true } },
      },
    });

    if (Number.isFinite(odometerKm) && odometerKm != null) {
      await tx.fleetVehicle.update({
        where: { id: vehicleId },
        data: { odometerKm },
      });
    }

    return log;
  });

  return NextResponse.json(
    {
      id: row.id,
      vehicleRegistration: row.vehicle.registration,
      fueledAt: row.fueledAt.toISOString(),
      liters: Number(row.liters),
      amountKes: Number(row.amountKes),
    },
    { status: 201 },
  );
}
