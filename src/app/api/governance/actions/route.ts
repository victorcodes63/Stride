import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeAction } from '@/lib/governance/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const actions = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const resolutionId = request.nextUrl.searchParams.get('resolutionId')?.trim() || undefined;
        const meetingId = request.nextUrl.searchParams.get('meetingId')?.trim() || undefined;
        const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

        return tx.governanceActionItem.findMany({
          where: {
            ...ctx.where(),
            outsourcingClientId: clientId,
            ...(resolutionId ? { resolutionId } : {}),
            ...(meetingId ? { meetingId } : {}),
            ...(status ? { status: status as never } : {}),
          },
          include: {
            meeting: { select: { id: true, meetingCode: true, title: true } },
            resolution: { select: { id: true, resolutionCode: true, title: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          take: 200,
        });
      });

      return NextResponse.json({ actions: actions.map(serializeAction) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/governance/actions',
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

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 });

    const meetingId = typeof body.meetingId === 'string' ? body.meetingId.trim() : null;
    const resolutionId = typeof body.resolutionId === 'string' ? body.resolutionId.trim() : null;
    const description = typeof body.description === 'string' ? body.description.trim() : null;
    const dueDate =
      typeof body.dueDate === 'string' && body.dueDate.trim() ? new Date(body.dueDate) : null;
    const assigneeUserId = typeof body.assigneeUserId === 'string' ? body.assigneeUserId.trim() : null;

    try {
      const created = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);

        if (meetingId) {
          const meeting = await tx.governanceMeeting.findFirst({
            where: ctx.where({ id: meetingId, outsourcingClientId: clientId }),
            select: { id: true },
          });
          if (!meeting) return { error: 'meeting' as const };
        }
        if (resolutionId) {
          const resolution = await tx.governanceResolution.findFirst({
            where: ctx.where({ id: resolutionId, outsourcingClientId: clientId }),
            select: { id: true },
          });
          if (!resolution) return { error: 'resolution' as const };
        }

        const action = await tx.governanceActionItem.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            meetingId,
            resolutionId,
            title,
            description,
            dueDate,
            assigneeUserId: assigneeUserId || null,
            createdByUserId: ctx.staff.id,
          },
          include: {
            meeting: { select: { id: true, meetingCode: true, title: true } },
            resolution: { select: { id: true, resolutionCode: true, title: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
        });

        return { action };
      });

      if ('error' in created) {
        if (created.error === 'meeting') {
          return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Resolution not found.' }, { status: 404 });
      }

      return NextResponse.json({ action: serializeAction(created.action) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/governance/actions',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create action.' }, { status: 500 });
    }
  });
}
