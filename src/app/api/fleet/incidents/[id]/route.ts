import { NextRequest, NextResponse } from 'next/server';
import type { FleetIncidentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import {
  FLEET_INCIDENT_SEVERITY_LABELS,
  FLEET_INCIDENT_STATUS_LABELS,
  FLEET_INCIDENT_TYPE_LABELS,
} from '@/lib/fleet-incident';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const STATUSES: FleetIncidentStatus[] = ['open', 'investigating', 'resolved', 'closed'];

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
    status?: string;
    resolution?: string;
  } | null;

  const nextStatus = body?.status as FleetIncidentStatus | undefined;
  if (nextStatus && !STATUSES.includes(nextStatus)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const existing = await prisma.fleetIncident.findFirst({
    where: { id, outsourcingClientId: workspaceClientId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.fleetIncident.update({
      where: { id },
      data: {
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(body?.resolution !== undefined ? { resolution: body.resolution.trim() || null } : {}),
        ...((nextStatus === 'resolved' || nextStatus === 'closed') && !existing.resolvedAt
          ? { resolvedAt: new Date() }
          : {}),
      },
      include: {
        trip: {
          select: { id: true, tripNumber: true, origin: true, destination: true },
        },
      },
    });

    if (nextStatus) {
      await tx.fleetTripEvent.create({
        data: {
          tripId: row.tripId,
          eventType: 'incident_update',
          message: `Incident "${row.title}" marked ${FLEET_INCIDENT_STATUS_LABELS[nextStatus].toLowerCase()}.`,
          metadata: { incidentId: id, status: nextStatus, actorEmail: user.email },
        },
      });
    }

    return row;
  });

  return NextResponse.json({
    id: updated.id,
    tripId: updated.tripId,
    tripNumber: updated.trip.tripNumber,
    route: `${updated.trip.origin} → ${updated.trip.destination}`,
    incidentType: updated.incidentType,
    incidentTypeLabel: FLEET_INCIDENT_TYPE_LABELS[updated.incidentType],
    severity: updated.severity,
    severityLabel: FLEET_INCIDENT_SEVERITY_LABELS[updated.severity],
    status: updated.status,
    statusLabel: FLEET_INCIDENT_STATUS_LABELS[updated.status],
    title: updated.title,
    description: updated.description,
    resolution: updated.resolution,
    reportedAt: updated.reportedAt.toISOString(),
    resolvedAt: updated.resolvedAt?.toISOString() ?? null,
  });
}
