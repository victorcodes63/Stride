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

const ESCALATION_HOURS = 24;

function mapIncidentRow(row: {
  id: string;
  tripId: string;
  incidentType: FleetIncidentType;
  severity: FleetIncidentSeverity;
  status: string;
  title: string;
  description: string;
  resolution: string | null;
  reportedAt: Date;
  resolvedAt: Date | null;
  escalatedAt: Date | null;
  owner: { name: string } | null;
  trip: { tripNumber: string; origin: string; destination: string };
}) {
  const needsEscalation =
    row.severity === 'high' &&
    ['open', 'investigating'].includes(row.status) &&
    !row.escalatedAt &&
    row.reportedAt.getTime() < Date.now() - ESCALATION_HOURS * 60 * 60 * 1000;

  return {
    id: row.id,
    tripId: row.tripId,
    tripNumber: row.trip.tripNumber,
    route: `${row.trip.origin} → ${row.trip.destination}`,
    incidentType: row.incidentType,
    incidentTypeLabel: FLEET_INCIDENT_TYPE_LABELS[row.incidentType],
    severity: row.severity,
    severityLabel: FLEET_INCIDENT_SEVERITY_LABELS[row.severity],
    status: row.status,
    statusLabel: FLEET_INCIDENT_STATUS_LABELS[row.status as keyof typeof FLEET_INCIDENT_STATUS_LABELS],
    title: row.title,
    description: row.description,
    resolution: row.resolution,
    ownerName: row.owner?.name ?? null,
    reportedAt: row.reportedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    escalatedAt: row.escalatedAt?.toISOString() ?? null,
    needsEscalation,
  };
}

export async function GET(request: NextRequest) {
  return withFleetTenant(request, async (ctx) => {
    const openOnly = ctx.request.nextUrl.searchParams.get('open') === '1';
    const severity = ctx.request.nextUrl.searchParams.get('severity')?.trim();
    const tripId = ctx.request.nextUrl.searchParams.get('tripId')?.trim();

    const rows = await prisma.fleetIncident.findMany({
      where: fleetTenantWhere(ctx, {
        ...(openOnly ? { status: { in: ['open', 'investigating'] } } : {}),
        ...(severity ? { severity: severity as FleetIncidentSeverity } : {}),
        ...(tripId ? { tripId } : {}),
      }),
      include: {
        owner: { select: { name: true } },
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

    const mapped = rows.map(mapIncidentRow);

    for (const row of rows) {
      if (
        row.severity === 'high' &&
        ['open', 'investigating'].includes(row.status) &&
        !row.escalatedAt &&
        row.reportedAt.getTime() < Date.now() - ESCALATION_HOURS * 60 * 60 * 1000
      ) {
        await prisma.fleetIncident.update({
          where: { id: row.id },
          data: { escalatedAt: new Date() },
        });
      }
    }

    return NextResponse.json(mapped);
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
      ownerUserId?: string;
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
            ownerUserId: body?.ownerUserId?.trim() || ctx.staff.id,
          },
          include: {
            owner: { select: { name: true } },
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
            organizationId: ctx.organizationId,
            tripId,
            eventType: 'incident',
            message: `Incident logged: ${title}`,
            metadata: {
              incidentId: row.id,
              incidentType,
              severity,
              ownerUserId: row.ownerUserId,
              actorEmail: ctx.staff.email,
            },
          },
        });

        return row;
      });

      return NextResponse.json(mapIncidentRow(incident), { status: 201 });
    } catch (e) {
      if (e instanceof TripStatusTransitionError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
  });
}
