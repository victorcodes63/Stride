import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import { ensureTripComplianceChecks } from '@/lib/fleet-compliance';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessFleet(user)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { id } = await params;
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const trip = await prisma.fleetTrip.findFirst({
    where: { id, outsourcingClientId: workspaceClientId },
  });

  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await ensureTripComplianceChecks(prisma, id);

  const fullTrip = await prisma.fleetTrip.findFirst({
    where: { id },
    include: fleetTripDetailInclude,
  });

  if (!fullTrip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(tripToDetail(fullTrip));
}
