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
  FLEET_SETTLEMENT_STATUS_LABELS,
  FLEET_SETTLEMENT_TYPE_LABELS,
} from '@/lib/fleet-settlement';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessFleet(user)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }
  if (!process.env.DATABASE_URL) return NextResponse.json([]);

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const status = request.nextUrl.searchParams.get('status')?.trim();

  const rows = await prisma.fleetSettlement.findMany({
    where: {
      outsourcingClientId: workspaceClientId,
      ...(status ? { status: status as never } : {}),
    },
    include: {
      trip: {
        select: {
          id: true,
          tripNumber: true,
          origin: true,
          destination: true,
          status: true,
          isOutsourced: true,
          customer: { select: { name: true } },
        },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      tripId: row.tripId,
      tripNumber: row.trip.tripNumber,
      route: `${row.trip.origin} → ${row.trip.destination}`,
      customerName: row.trip.customer.name,
      settlementType: row.settlementType,
      settlementTypeLabel: FLEET_SETTLEMENT_TYPE_LABELS[row.settlementType],
      payeeName: row.payeeName,
      amountKes: Number(row.amountKes),
      status: row.status,
      statusLabel: FLEET_SETTLEMENT_STATUS_LABELS[row.status],
      podVerified: row.podVerified,
      notes: row.notes,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      paidAt: row.paidAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  );
}
