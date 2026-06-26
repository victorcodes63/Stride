import { NextRequest, NextResponse } from 'next/server';
import type { FleetTripStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import {
  driverCanSetTripStatus,
  getFleetDriverForEmployee,
} from '@/lib/ess-fleet';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import {
  applyTripStatusChange,
  TripStatusTransitionError,
} from '@/lib/fleet-trip-status-change';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) {
    return NextResponse.json({ error: 'No linked employee profile.' }, { status: 400 });
  }

  const driver = await getFleetDriverForEmployee(prisma, user.employeeId);
  if (!driver) {
    return NextResponse.json({ error: 'You are not registered as a fleet driver.' }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: string; note?: string } | null;
  const nextStatus = body?.status as FleetTripStatus | undefined;
  const note = typeof body?.note === 'string' ? body.note.trim() : '';

  if (!nextStatus) {
    return NextResponse.json({ error: 'Status is required.' }, { status: 400 });
  }

  const existing = await prisma.fleetTrip.findFirst({
    where: {
      id,
      driverId: driver.id,
      organizationId: driver.organizationId,
      outsourcingClientId: driver.outsourcingClientId,
    },
  });

  if (!existing) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
  if (!driverCanSetTripStatus(existing.status, nextStatus)) {
    return NextResponse.json({ error: 'That status change is not allowed.' }, { status: 400 });
  }

  try {
    const trip = await prisma.$transaction((tx) =>
      applyTripStatusChange(tx, {
        tripId: id,
        from: existing.status,
        to: nextStatus,
        actor: 'driver',
        actorEmail: user.email,
        source: 'ess',
        note: note || undefined,
      }),
    );
    return NextResponse.json(tripToDetail(trip));
  } catch (e) {
    if (e instanceof TripStatusTransitionError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
