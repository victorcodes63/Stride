import { NextRequest, NextResponse } from 'next/server';
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
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const vehicles = await prisma.fleetVehicle.findMany({
    where: { outsourcingClientId: workspaceClientId },
    orderBy: [{ status: 'asc' }, { registration: 'asc' }],
  });

  return NextResponse.json(
    vehicles.map((v) => ({
      id: v.id,
      registration: v.registration,
      label: v.label,
      vehicleType: v.vehicleType,
      ownership: v.ownership,
      status: v.status,
      depotLocation: v.depotLocation,
      capacityKg: v.capacityKg,
    })),
  );
}
