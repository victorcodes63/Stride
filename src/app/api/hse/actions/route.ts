import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeAction } from '@/lib/hse/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const actions = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const incidentId = request.nextUrl.searchParams.get('incidentId')?.trim() || undefined;
        const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

        return tx.hseAction.findMany({
          where: {
            ...ctx.where(),
            outsourcingClientId: clientId,
            ...(incidentId ? { incidentId } : {}),
            ...(status ? { status: status as never } : {}),
          },
          include: {
            incident: { select: { id: true, incidentNumber: true, title: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          take: 200,
        });
      });

      return NextResponse.json({ actions: actions.map(serializeAction) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/hse/actions',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load actions.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const incidentId = typeof body.incidentId === 'string' ? body.incidentId.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!incidentId || !title) {
      return NextResponse.json({ error: 'Incident and title are required.' }, { status: 400 });
    }

    const description = typeof body.description === 'string' ? body.description.trim() : null;
    const dueDate =
      typeof body.dueDate === 'string' && body.dueDate.trim() ? new Date(body.dueDate) : null;
    const assigneeUserId = typeof body.assigneeUserId === 'string' ? body.assigneeUserId.trim() : null;

    try {
      const created = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const incident = await tx.hseIncident.findFirst({
          where: { ...ctx.where(), id: incidentId, outsourcingClientId: clientId },
          select: { id: true },
        });
        if (!incident) return null;

        const action = await tx.hseAction.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            incidentId,
            title,
            description,
            dueDate,
            assigneeUserId: assigneeUserId || null,
            createdByUserId: ctx.staff.id,
          },
          include: {
            incident: { select: { id: true, incidentNumber: true, title: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
        });

        if (action.incidentId) {
          await tx.hseIncident.updateMany({
            where: { id: incidentId, status: 'open' },
            data: { status: 'investigating' },
          });
        }

        return action;
      });
      if (!created) return NextResponse.json({ error: 'Incident not found.' }, { status: 404 });

      return NextResponse.json({ action: serializeAction(created) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/hse/actions',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create action.' }, { status: 500 });
    }
  });
}
