import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeTicket } from '@/lib/facilities/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      typeof body.category === 'string' &&
      ['plumbing', 'electrical', 'hvac', 'structural', 'cleaning', 'other'].includes(body.category)
    ) {
      data.category = body.category;
    }
    if (
      typeof body.priority === 'string' &&
      ['low', 'medium', 'high', 'urgent'].includes(body.priority)
    ) {
      data.priority = body.priority;
    }
    if (
      typeof body.status === 'string' &&
      ['open', 'in_progress', 'on_hold', 'resolved', 'closed'].includes(body.status)
    ) {
      data.status = body.status;
      if (body.status === 'resolved' || body.status === 'closed') {
        data.resolvedAt = new Date();
      } else {
        data.resolvedAt = null;
      }
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
        const existing = await tx.facilityMaintenanceTicket.findFirst({
          where: ctx.where({ id, outsourcingClientId: clientId }),
          select: { id: true },
        });
        if (!existing) return null;

        return tx.facilityMaintenanceTicket.update({
          where: { id },
          data,
          include: {
            site: { select: { id: true, siteCode: true, name: true } },
            assignee: { select: { id: true, name: true, email: true } },
            reportedBy: { select: { id: true, name: true, email: true } },
          },
        });
      });

      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ticket: serializeTicket(updated) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/facilities/tickets/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update ticket.' }, { status: 500 });
    }
  });
}
