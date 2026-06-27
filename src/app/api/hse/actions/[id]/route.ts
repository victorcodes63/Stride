import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeAction } from '@/lib/hse/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    if (typeof body.description === 'string') data.description = body.description.trim() || null;
    if (
      typeof body.status === 'string' &&
      ['open', 'in_progress', 'completed', 'cancelled'].includes(body.status)
    ) {
      data.status = body.status;
      if (body.status === 'completed') data.completedAt = new Date();
      else if (body.status !== 'completed') data.completedAt = null;
    }
    if (typeof body.dueDate === 'string') {
      data.dueDate = body.dueDate.trim() ? new Date(body.dueDate) : null;
    }
    if (typeof body.assigneeUserId === 'string') {
      data.assigneeUserId = body.assigneeUserId.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    try {
      const updated = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const existing = await tx.hseAction.findFirst({
          where: { ...ctx.where(), id, outsourcingClientId: clientId },
          select: { id: true },
        });
        if (!existing) return null;

        return tx.hseAction.update({
          where: { id },
          data,
          include: {
            incident: { select: { id: true, incidentNumber: true, title: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
        });
      });
      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      return NextResponse.json({ action: serializeAction(updated) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/hse/actions/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update action.' }, { status: 500 });
    }
  });
}
