import { NextRequest, NextResponse } from 'next/server';
import type { FleetTripStatus } from '@prisma/client';
import { driverCanSetTripStatus, getFleetDriverForEmployee } from '@/lib/ess-fleet';
import { tripToDetail } from '@/lib/fleet-api';
import {
  applyTripStatusChange,
  TripStatusTransitionError,
} from '@/lib/fleet-trip-status-change';
import { withEssTenant } from '@/lib/ess-tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) {
      return NextResponse.json({ error: 'No linked employee profile.' }, { status: 400 });
    }

    const driver = await ctx.run((tx) => getFleetDriverForEmployee(tx, ctx.employeeId!));
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

    const existing = await ctx.run((tx) =>
      tx.fleetTrip.findFirst({
        where: ctx.where({
          id,
          driverId: driver.id,
          outsourcingClientId: driver.outsourcingClientId,
        }),
      }),
    );

    if (!existing) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
    if (!driverCanSetTripStatus(existing.status, nextStatus)) {
      return NextResponse.json({ error: 'That status change is not allowed.' }, { status: 400 });
    }

    try {
      const trip = await ctx.run((tx) =>
        applyTripStatusChange(tx, {
          tripId: id,
          from: existing.status,
          to: nextStatus,
          actor: 'driver',
          actorEmail: ctx.essUser.email,
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
  });
}
