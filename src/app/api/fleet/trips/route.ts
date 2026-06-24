import { NextRequest, NextResponse } from 'next/server';
import type { FleetTripStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { fleetTripInclude, tripToListRow } from '@/lib/fleet-api';
import { FLEET_TRIP_STATUSES } from '@/lib/fleet-status';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessFleet(user)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const statusRaw = request.nextUrl.searchParams.get('status');
  const status =
    statusRaw && FLEET_TRIP_STATUSES.includes(statusRaw as FleetTripStatus)
      ? (statusRaw as FleetTripStatus)
      : undefined;

  const trips = await prisma.fleetTrip.findMany({
    where: {
      outsourcingClientId: workspaceClientId,
      ...(status ? { status } : {}),
    },
    include: fleetTripInclude,
    orderBy: [{ updatedAt: 'desc' }],
    take: 200,
  });

  return NextResponse.json(trips.map(tripToListRow));
}
