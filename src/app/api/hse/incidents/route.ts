import { NextRequest, NextResponse } from 'next/server';
import type { HseIncidentSeverity, HseIncidentType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { allocateIncidentNumber } from '@/lib/hse/incident-code';
import { serializeIncident } from '@/lib/hse/serialize';

const INCIDENT_TYPES: HseIncidentType[] = [
  'hazard',
  'near_miss',
  'injury',
  'fire',
  'equipment_failure',
  'environmental',
  'other',
];

const SEVERITIES: HseIncidentSeverity[] = ['low', 'medium', 'high', 'critical'];

const incidentInclude = {
  reportedByUser: { select: { name: true } },
  reportedByEmployee: { select: { firstName: true, lastName: true } },
  actions: { select: { id: true, status: true } },
} as const;

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;
    const siteName = request.nextUrl.searchParams.get('siteName')?.trim() || undefined;

    const incidents = await prisma.hseIncident.findMany({
      where: {
        outsourcingClientId: clientId,
        ...(status ? { status: status as never } : {}),
        ...(siteName ? { siteName } : {}),
      },
      include: incidentInclude,
      orderBy: [{ occurredAt: 'desc' }],
      take: 200,
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const openCount = incidents.filter((i) => i.status === 'open').length;
    const followUpCount = incidents.filter(
      (i) => i.status === 'open' || i.status === 'investigating',
    ).length;
    const resolvedThisMonth = incidents.filter(
      (i) =>
        (i.status === 'resolved' || i.status === 'closed') &&
        (i.resolvedAt ?? i.closedAt ?? i.updatedAt) >= monthStart,
    ).length;
    const nearMissCount = incidents.filter((i) => i.incidentType === 'near_miss').length;
    const latest = incidents[0]?.occurredAt;
    const daysSinceLast =
      latest == null
        ? null
        : Math.max(0, Math.floor((now.getTime() - latest.getTime()) / 86400000));

    return NextResponse.json({
      incidents: incidents.map(serializeIncident),
      summary: {
        openCount,
        followUpCount,
        resolvedThisMonth,
        nearMissCount,
        daysSinceLast,
      },
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/hse/incidents',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load incidents.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!title || !description) {
    return NextResponse.json({ error: 'Title and description are required.' }, { status: 400 });
  }

  const incidentType =
    typeof body.incidentType === 'string' && INCIDENT_TYPES.includes(body.incidentType as HseIncidentType)
      ? (body.incidentType as HseIncidentType)
      : 'other';
  const severity =
    typeof body.severity === 'string' && SEVERITIES.includes(body.severity as HseIncidentSeverity)
      ? (body.severity as HseIncidentSeverity)
      : 'medium';
  const siteName = typeof body.siteName === 'string' ? body.siteName.trim() : null;
  const location = typeof body.location === 'string' ? body.location.trim() : null;
  const immediateAction =
    typeof body.immediateAction === 'string' ? body.immediateAction.trim() : null;
  const injuredParty = typeof body.injuredParty === 'string' ? body.injuredParty.trim() : null;
  const occurredAt =
    typeof body.occurredAt === 'string' && body.occurredAt.trim()
      ? new Date(body.occurredAt)
      : new Date();

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const incidentNumber = await allocateIncidentNumber(prisma, clientId);

    const created = await prisma.hseIncident.create({
      data: {
        organizationId: user.currentOrgId,
        outsourcingClientId: clientId,
        incidentNumber,
        title,
        description,
        incidentType,
        severity,
        siteName,
        location,
        occurredAt,
        immediateAction,
        injuredParty,
        reportedByUserId: user.id,
        createdByUserId: user.id,
      },
      include: incidentInclude,
    });

    return NextResponse.json({ incident: serializeIncident(created) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/hse/incidents',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create incident.' }, { status: 500 });
  }
}
