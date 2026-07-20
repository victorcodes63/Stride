import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import {
  serializeIncident,
  serializeAttachment,
  HSE_ACTION_STATUS_LABELS,
  HSE_ROOT_CAUSE_CATEGORY_VALUES,
} from '@/lib/hse/serialize';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const incidentInclude = {
  reportedByUser: { select: { name: true } },
  reportedByEmployee: { select: { firstName: true, lastName: true } },
  actions: {
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      dueDate: true,
      completedAt: true,
      assignee: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  attachments: {
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      contentType: true,
      fileSize: true,
      kind: true,
      uploadedByUserId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  return withTenant(request, async (ctx) => {
    const { id } = await params;

    try {
      const incident = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        return tx.hseIncident.findFirst({
          where: { ...ctx.where(), id, outsourcingClientId: clientId },
          include: incidentInclude,
        });
      });
      if (!incident) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      return NextResponse.json({
        incident: {
          ...serializeIncident(incident),
          actions: incident.actions.map((a) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            status: a.status,
            statusLabel: HSE_ACTION_STATUS_LABELS[a.status],
            dueDate: a.dueDate?.toISOString().slice(0, 10) ?? null,
            completedAt: a.completedAt?.toISOString() ?? null,
            assignee: a.assignee,
          })),
          attachments: incident.attachments.map(serializeAttachment),
        },
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/hse/incidents/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load incident.' }, { status: 500 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  return withTenant(request, async (ctx) => {
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if (typeof body.description === 'string') data.description = body.description.trim();
    if (
      typeof body.status === 'string' &&
      ['open', 'investigating', 'resolved', 'closed'].includes(body.status)
    ) {
      data.status = body.status;
      if (body.status === 'resolved') data.resolvedAt = new Date();
      if (body.status === 'closed') {
        data.closedAt = new Date();
        if (!data.resolvedAt) data.resolvedAt = new Date();
      }
      if (body.status === 'open' || body.status === 'investigating') {
        data.resolvedAt = null;
        data.closedAt = null;
      }
    }
    if (
      typeof body.severity === 'string' &&
      ['low', 'medium', 'high', 'critical'].includes(body.severity)
    ) {
      data.severity = body.severity;
    }
    if (typeof body.immediateAction === 'string') {
      data.immediateAction = body.immediateAction.trim() || null;
    }
    if (typeof body.injuredParty === 'string') {
      data.injuredParty = body.injuredParty.trim() || null;
    }

    // Investigation fields.
    if (typeof body.rootCause === 'string') {
      data.rootCause = body.rootCause.trim() || null;
    }
    if (body.rootCauseCategory === null || body.rootCauseCategory === '') {
      data.rootCauseCategory = null;
    } else if (
      typeof body.rootCauseCategory === 'string' &&
      HSE_ROOT_CAUSE_CATEGORY_VALUES.includes(body.rootCauseCategory)
    ) {
      data.rootCauseCategory = body.rootCauseCategory;
    }
    if (typeof body.witnessNames === 'string') {
      data.witnessNames = body.witnessNames.trim() || null;
    }
    if (typeof body.reportableToAuthority === 'boolean') {
      data.reportableToAuthority = body.reportableToAuthority;
    }
    if (typeof body.lostTimeInjury === 'boolean') {
      data.lostTimeInjury = body.lostTimeInjury;
    }
    if (body.lostTimeDays === null) {
      data.lostTimeDays = null;
    } else if (typeof body.lostTimeDays === 'number' && Number.isFinite(body.lostTimeDays)) {
      data.lostTimeDays = Math.max(0, Math.trunc(body.lostTimeDays));
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    try {
      const updated = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const existing = await tx.hseIncident.findFirst({
          where: { ...ctx.where(), id, outsourcingClientId: clientId },
          select: { id: true },
        });
        if (!existing) return null;

        return tx.hseIncident.update({
          where: { id },
          data,
          include: {
            reportedByUser: { select: { name: true } },
            reportedByEmployee: { select: { firstName: true, lastName: true } },
            actions: { select: { id: true, status: true } },
          },
        });
      });
      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      return NextResponse.json({ incident: serializeIncident(updated) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/hse/incidents/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update incident.' }, { status: 500 });
    }
  });
}
