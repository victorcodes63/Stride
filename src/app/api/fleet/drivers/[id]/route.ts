import { NextRequest, NextResponse } from 'next/server';
import type { FleetDriverStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { FLEET_DRIVER_STATUS_LABELS } from '@/lib/fleet/registers';

export const dynamic = 'force-dynamic';

const DRIVER_STATUSES = new Set<FleetDriverStatus>([
  'available',
  'on_trip',
  'off_duty',
  'suspended',
]);

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessFleet(user)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const existing = await prisma.fleetDriver.findFirst({
    where: { id, outsourcingClientId: workspaceClientId },
  });
  if (!existing) return NextResponse.json({ error: 'Driver not found.' }, { status: 404 });

  const status = body?.status as FleetDriverStatus | undefined;
  if (status && !DRIVER_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid driver status.' }, { status: 400 });
  }

  const row = await prisma.fleetDriver.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(typeof body?.phone === 'string' ? { phone: body.phone.trim() || null } : {}),
      ...(typeof body?.notes === 'string' ? { notes: body.notes.trim() || null } : {}),
    },
  });

  return NextResponse.json({
    id: row.id,
    status: row.status,
    statusLabel: FLEET_DRIVER_STATUS_LABELS[row.status],
  });
}
