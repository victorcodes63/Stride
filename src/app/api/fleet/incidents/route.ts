import { NextRequest, NextResponse } from 'next/server';
import type { FleetIncidentSeverity, FleetIncidentType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withFleetTenant, fleetTenantWhere } from '@/lib/fleet-tenant-api';
import { canTransitionTripStatus } from '@/lib/fleet-status';
import {
  FLEET_INCIDENT_SEVERITY_LABELS,
  FLEET_INCIDENT_STATUS_LABELS,
  FLEET_INCIDENT_TYPE_LABELS,
  FLEET_INCIDENT_TYPES,
} from '@/lib/fleet-incident';
import {
  applyTripStatusChange,
  TripStatusTransitionError,
} from '@/lib/fleet-trip-status-change';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const openOnly = ctx.request.nextUrl.searchParams.get('open') === '1';

    const rows = await prisma.fleetIncident.findMany({
      where: fleetTenantWhere(ctx, {
        ...(openOnly ? { status: { in: ['open', 'investigating'] } } : {}),
      }),
      include: {
        trip: {
          select: {
            id: true,
            tripNumber: true,
            origin: true,
            destination: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { reportedAt: 'desc' }],
    });

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        tripId: row.tripId,
        tripNumber: row.trip.tripNumber,
        route: `${row.trip.origin} → ${row.trip.destination}`,
        incidentType: row.incidentType,
        incidentTypeLabel: FLEET_INCIDENT_TYPE_LABELS[row.incidentType],
        severity: row.severity,
        severityLabel: FLEET_INCIDENT_SEVERITY_LABELS[row.severity],
        status: row.status,
        statusLabel: FLEET_INCIDENT_STATUS_LABELS[row.status],
        title: row.title,
        description: row.description,
        resolution: row.resolution,
        reportedAt: row.reportedAt.toISOString(),
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
      })),
    );
  });
}

export async function POST(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const body = (await request.json().catch(() => null)) as {
      tripId?: string;
      incidentType?: string;
      severity?: string;
      title?: string;
      description?: string;
    } | null;

    const tripId = body?.tripId?.trim();
    const incidentType = body?.incidentType as FleetIncidentType | undefined;
    const title = body?.title?.trim();
    const description = body?.description?.trim();

    if (!tripId || !title || !description) {
      return NextResponse.json({ error: 'tripId, title, and description are required.' }, { status: 400 });
    }
    if (!incidentType || !FLEET_INCIDENT_TYPES.includes(incidentType)) {
      return NextResponse.json({ error: 'Invalid incident type.' }, { status: 400 });
    }

    const severity = (body?.severity ?? 'medium') as FleetIncidentSeverity;
    if (!['low', 'medium', 'high'].includes(severity)) {
      return NextResponse.json({ error: 'Invalid severity.' }, { status: 400 });
    }

    const trip = await prisma.fleetTrip.findFirst({
      where: fleetTenantWhere(ctx, { id: tripId }),
      select: { id: true, tripNumber: true, status: true },
    });
    if (!trip) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });

    if (!canTransitionTripStatus(trip.status, 'exception', 'staff')) {
      return NextResponse.json(
        { error: 'Trip cannot be moved to exception from its current status.' },
        { status: 400 },
      );
    }

    try {
      const incident = await prisma.$transaction(async (tx) => {
        const row = await tx.fleetIncident.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId: ctx.workspaceClientId,
            tripId,
            incidentType,
            severity,
            title,
            description,
          },
          include: {
            trip: {
              select: { id: true, tripNumber: true, origin: true, destination: true },
            },
          },
        });

        await applyTripStatusChange(tx, {
          tripId,
          from: trip.status,
          to: 'exception',
          actor: 'staff',
          actorEmail: ctx.staff.email,
          source: 'incident',
          note: title,
        });

        await tx.fleetTripEvent.create({
          data: {
            tripId,
            eventType: 'incident',
            message: `Incident logged: ${title}`,
            metadata: { incidentId: row.id, incidentType, severity, actorEmail: ctx.staff.email },
          },
        });

        return row;
      });

      return NextResponse.json(
        {
          id: incident.id,
          tripId: incident.tripId,
          tripNumber: incident.trip.tripNumber,
          route: `${incident.trip.origin} → ${incident.trip.destination}`,
          incidentType: incident.incidentType,
          incidentTypeLabel: FLEET_INCIDENT_TYPE_LABELS[incident.incidentType],
          severity: incident.severity,
          severityLabel: FLEET_INCIDENT_SEVERITY_LABELS[incident.severity],
          status: incident.status,
          statusLabel: FLEET_INCIDENT_STATUS_LABELS[incident.status],
          title: incident.title,
          description: incident.description,
          resolution: incident.resolution,
          reportedAt: incident.reportedAt.toISOString(),
          resolvedAt: null,
        },
        { status: 201 },
      );
    } catch (e) {
      if (e instanceof TripStatusTransitionError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
  });
}
