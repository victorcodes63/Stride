import { NextRequest, NextResponse } from 'next/server';
import type { Prisma, HseIncidentSeverity, HseIncidentType } from '@prisma/client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { allocateIncidentNumber } from '@/lib/hse/incident-code';
import { serializeIncident } from '@/lib/hse/serialize';
import { HSE_ROOT_CAUSE_CATEGORY_VALUES } from '@/lib/hse/serialize';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

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

const SORTABLE_FIELDS = new Set([
  'occurredAt',
  'incidentNumber',
  'title',
  'severity',
  'status',
  'siteName',
  'incidentType',
]);

const incidentInclude = {
  reportedByUser: { select: { name: true } },
  reportedByEmployee: { select: { firstName: true, lastName: true } },
  actions: { select: { id: true, status: true } },
} as const;

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      items: [],
      incidents: [],
      total: 0,
      page: 1,
      pageSize: 20,
      summary: {
        openCount: 0,
        followUpCount: 0,
        resolvedThisMonth: 0,
        nearMissCount: 0,
        daysSinceLast: null,
      },
    });
  }

  return withTenant(request, async (ctx) => {
    try {
      const sp = request.nextUrl.searchParams;
      const status = sp.get('status')?.trim() || undefined;
      const siteName = sp.get('siteName')?.trim() || undefined;
      const q = sp.get('q')?.trim() || undefined;

      const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1);
      const pageSizeRaw = Number.parseInt(sp.get('pageSize') ?? '20', 10) || 20;
      const pageSize = Math.min(100, Math.max(1, pageSizeRaw));

      const sortKeyRaw = sp.get('sort')?.trim() || 'occurredAt';
      const sortKey = SORTABLE_FIELDS.has(sortKeyRaw) ? sortKeyRaw : 'occurredAt';
      const sortDir = sp.get('dir')?.trim() === 'asc' ? 'asc' : 'desc';

      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);

        const where: Prisma.HseIncidentWhereInput = {
          ...ctx.where(),
          outsourcingClientId: clientId,
          ...(status ? { status: status as never } : {}),
          ...(siteName ? { siteName } : {}),
          ...(q
            ? {
                OR: [
                  { incidentNumber: { contains: q, mode: 'insensitive' } },
                  { title: { contains: q, mode: 'insensitive' } },
                  { siteName: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        };

        const orderBy: Prisma.HseIncidentOrderByWithRelationInput[] = [
          { [sortKey]: sortDir } as Prisma.HseIncidentOrderByWithRelationInput,
        ];
        if (sortKey !== 'occurredAt') orderBy.push({ occurredAt: 'desc' });

        const [items, total] = await Promise.all([
          tx.hseIncident.findMany({
            where,
            include: incidentInclude,
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          tx.hseIncident.count({ where }),
        ]);

        // Summary aggregates computed across the full (client-scoped) dataset in DB.
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const scope = { ...ctx.where(), outsourcingClientId: clientId } as Prisma.HseIncidentWhereInput;

        const [openCount, followUpCount, resolvedThisMonth, nearMissCount, latest] = await Promise.all([
          tx.hseIncident.count({ where: { ...scope, status: 'open' } }),
          tx.hseIncident.count({ where: { ...scope, status: { in: ['open', 'investigating'] } } }),
          tx.hseIncident.count({
            where: {
              ...scope,
              status: { in: ['resolved', 'closed'] },
              OR: [{ resolvedAt: { gte: monthStart } }, { closedAt: { gte: monthStart } }],
            },
          }),
          tx.hseIncident.count({ where: { ...scope, incidentType: 'near_miss' } }),
          tx.hseIncident.findFirst({
            where: scope,
            orderBy: { occurredAt: 'desc' },
            select: { occurredAt: true },
          }),
        ]);

        const daysSinceLast =
          latest?.occurredAt == null
            ? null
            : Math.max(0, Math.floor((now.getTime() - latest.occurredAt.getTime()) / 86400000));

        return {
          items,
          total,
          summary: { openCount, followUpCount, resolvedThisMonth, nearMissCount, daysSinceLast },
        };
      });

      const serialized = result.items.map(serializeIncident);

      return NextResponse.json({
        items: serialized,
        incidents: serialized,
        total: result.total,
        page,
        pageSize,
        summary: result.summary,
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/hse/incidents',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load incidents.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  return withTenant(request, async (ctx) => {
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

    // Optional investigation fields accepted at creation time.
    const rootCause = typeof body.rootCause === 'string' ? body.rootCause.trim() || null : null;
    const rootCauseCategory =
      typeof body.rootCauseCategory === 'string' &&
      HSE_ROOT_CAUSE_CATEGORY_VALUES.includes(body.rootCauseCategory)
        ? body.rootCauseCategory
        : null;
    const witnessNames = typeof body.witnessNames === 'string' ? body.witnessNames.trim() || null : null;
    const reportableToAuthority =
      typeof body.reportableToAuthority === 'boolean' ? body.reportableToAuthority : false;
    const lostTimeInjury = typeof body.lostTimeInjury === 'boolean' ? body.lostTimeInjury : false;
    const lostTimeDays =
      typeof body.lostTimeDays === 'number' && Number.isFinite(body.lostTimeDays)
        ? Math.max(0, Math.trunc(body.lostTimeDays))
        : null;

    try {
      const created = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const incidentNumber = await allocateIncidentNumber(tx, clientId);

        return tx.hseIncident.create({
          data: {
            organizationId: ctx.organizationId,
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
            rootCause,
            rootCauseCategory,
            witnessNames,
            reportableToAuthority,
            lostTimeInjury,
            lostTimeDays,
            reportedByUserId: ctx.staff.id,
            createdByUserId: ctx.staff.id,
          },
          include: incidentInclude,
        });
      });

      return NextResponse.json({ incident: serializeIncident(created) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/hse/incidents',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create incident.' }, { status: 500 });
    }
  });
}
