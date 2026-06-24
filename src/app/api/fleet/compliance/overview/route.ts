import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import {
  FLEET_COMPLIANCE_CHECK_LABELS,
  FLEET_COMPLIANCE_RESULT_LABELS,
} from '@/lib/fleet-compliance';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessFleet(user)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ trips: [], summary: { pending: 0, failed: 0 } });
  }

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const trips = await prisma.fleetTrip.findMany({
    where: {
      outsourcingClientId: workspaceClientId,
      status: { in: ['allocated', 'compliance_check', 'loaded', 'in_transit'] },
      complianceChecks: {
        some: { result: { in: ['pending', 'failed'] } },
      },
    },
    include: {
      customer: { select: { name: true } },
      complianceChecks: {
        where: { result: { in: ['pending', 'failed'] } },
        orderBy: { checkType: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  let pending = 0;
  let failed = 0;
  for (const trip of trips) {
    for (const check of trip.complianceChecks) {
      if (check.result === 'pending') pending += 1;
      if (check.result === 'failed') failed += 1;
    }
  }

  return NextResponse.json({
    summary: { pending, failed, tripsWithIssues: trips.length },
    trips: trips.map((trip) => ({
      id: trip.id,
      tripNumber: trip.tripNumber,
      status: trip.status,
      origin: trip.origin,
      destination: trip.destination,
      customerName: trip.customer.name,
      openChecks: trip.complianceChecks.map((c) => ({
        id: c.id,
        checkType: c.checkType,
        checkLabel: FLEET_COMPLIANCE_CHECK_LABELS[c.checkType],
        result: c.result,
        resultLabel: FLEET_COMPLIANCE_RESULT_LABELS[c.result],
      })),
    })),
  });
}
