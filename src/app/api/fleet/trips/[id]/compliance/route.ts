import { NextRequest, NextResponse } from 'next/server';
import type { FleetComplianceCheckType, FleetComplianceResult } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import {
  ensureTripComplianceChecks,
  FLEET_COMPLIANCE_CHECK_TYPES,
} from '@/lib/fleet-compliance';
import { FLEET_TRIP_STATUS_LABELS } from '@/lib/fleet-status';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

async function loadTripForWorkspace(tripId: string, workspaceClientId: string) {
  return prisma.fleetTrip.findFirst({
    where: { id: tripId, outsourcingClientId: workspaceClientId },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessFleet(user)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    checkType?: string;
    result?: string;
    notes?: string;
  } | null;

  const checkType = body?.checkType;
  const result = body?.result as FleetComplianceResult | undefined;

  if (
    !checkType ||
    !FLEET_COMPLIANCE_CHECK_TYPES.includes(checkType as FleetComplianceCheckType) ||
    !result ||
    !['pending', 'passed', 'failed', 'waived'].includes(result)
  ) {
    return NextResponse.json({ error: 'Invalid compliance update.' }, { status: 400 });
  }

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const trip = await loadTripForWorkspace(id, workspaceClientId);
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await ensureTripComplianceChecks(prisma, id);

  const updated = await prisma.$transaction(async (tx) => {
    const check = await tx.fleetTripComplianceCheck.update({
      where: {
        tripId_checkType: {
          tripId: id,
          checkType: checkType as FleetComplianceCheckType,
        },
      },
      data: {
        result,
        notes: body?.notes?.trim() || null,
        checkedByUserId: user.id,
        checkedAt: new Date(),
      },
    });

    await tx.fleetTripEvent.create({
      data: {
        tripId: id,
        eventType: 'compliance',
        message: `${check.checkType.replace(/_/g, ' ')} marked ${result}.`,
        metadata: { checkType, result, actorEmail: user.email },
      },
    });

    return tx.fleetTrip.findFirst({
      where: { id },
      include: fleetTripDetailInclude,
    });
  });

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allPassed = updated.complianceChecks.every(
    (c) => c.result === 'passed' || c.result === 'waived',
  );
  if (
    allPassed &&
    updated.complianceChecks.length > 0 &&
    updated.status === 'compliance_check'
  ) {
    const advanced = await prisma.$transaction(async (tx) => {
      await tx.fleetTripEvent.create({
        data: {
          tripId: id,
          eventType: 'status_change',
          message: `All pre-trip checks passed — ready for ${FLEET_TRIP_STATUS_LABELS.loaded}.`,
        },
      });
      return tx.fleetTrip.findFirst({
        where: { id },
        include: fleetTripDetailInclude,
      });
    });
    return NextResponse.json(tripToDetail(advanced ?? updated));
  }

  return NextResponse.json(tripToDetail(updated));
}
