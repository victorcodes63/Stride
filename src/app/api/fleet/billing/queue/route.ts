import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { estimateTripFreightExVatKes } from '@/lib/fleet-settlement';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessFleet(user)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }
  if (!process.env.DATABASE_URL) return NextResponse.json([]);

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const trips = await prisma.fleetTrip.findMany({
    where: {
      outsourcingClientId: workspaceClientId,
      status: { in: ['delivered', 'settled'] },
      clientInvoiceId: null,
    },
    include: {
      customer: { select: { name: true } },
      documents: { where: { docType: 'pod' }, select: { id: true } },
    },
    orderBy: { actualDeliveryAt: 'desc' },
    take: 50,
  });

  return NextResponse.json(
    trips.map((trip) => ({
      id: trip.id,
      tripNumber: trip.tripNumber,
      status: trip.status,
      origin: trip.origin,
      destination: trip.destination,
      customerName: trip.customer.name,
      hasPod: trip.documents.length > 0,
      estimatedFreightExVat: estimateTripFreightExVatKes({
        plannedDistanceKm: trip.plannedDistanceKm,
        cargoWeightKg: trip.cargoWeightKg,
      }),
      actualDeliveryAt: trip.actualDeliveryAt?.toISOString() ?? null,
    })),
  );
}
