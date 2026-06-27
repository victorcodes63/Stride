import { NextRequest, NextResponse } from 'next/server';
import type { FleetIncidentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import {
  FLEET_INCIDENT_SEVERITY_LABELS,
  FLEET_INCIDENT_STATUS_LABELS,
  FLEET_INCIDENT_TYPE_LABELS,
} from '@/lib/fleet-incident';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const STATUSES: FleetIncidentStatus[] = ['open', 'investigating', 'resolved', 'closed'];

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withFleetTenant(request, async (ctx) => {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      status?: string;
      resolution?: string;
      ownerUserId?: string;
      escalate?: boolean;
    } | null;

    const nextStatus = body?.status as FleetIncidentStatus | undefined;
    if (nextStatus && !STATUSES.includes(nextStatus)) {
      return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
    }

    const existing = await prisma.fleetIncident.findFirst({
      where: fleetTenantWhere(ctx, { id }),
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.fleetIncident.update({
        where: { id },
        data: {
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(body?.resolution !== undefined ? { resolution: body.resolution.trim() || null } : {}),
          ...(body?.ownerUserId !== undefined
            ? { ownerUserId: body.ownerUserId.trim() || null }
            : {}),
          ...(body?.escalate ? { escalatedAt: new Date() } : {}),
          ...((nextStatus === 'resolved' || nextStatus === 'closed') && !existing.resolvedAt
            ? { resolvedAt: new Date() }
            : {}),
        },
        include: {
          owner: { select: { name: true } },
          trip: {
            select: { id: true, tripNumber: true, origin: true, destination: true },
          },
        },
      });

      if (nextStatus || body?.escalate) {
        await tx.fleetTripEvent.create({
          data: {
            organizationId: ctx.organizationId,
            tripId: row.tripId,
            eventType: 'incident_update',
            message: body?.escalate
              ? `Incident "${row.title}" escalated.`
              : `Incident "${row.title}" marked ${nextStatus ? FLEET_INCIDENT_STATUS_LABELS[nextStatus].toLowerCase() : 'updated'}.`,
            metadata: {
              incidentId: id,
              status: nextStatus ?? row.status,
              actorEmail: ctx.staff.email,
            },
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
      ownerName: updated.owner?.name ?? null,
      reportedAt: updated.reportedAt.toISOString(),
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      escalatedAt: updated.escalatedAt?.toISOString() ?? null,
    });
  });
}
