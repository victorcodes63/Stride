import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { logProjectActivity } from '@/lib/projects/activity';
import { clampProgress } from '@/lib/projects/progress';
import { serializeMilestone } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

const MILESTONE_STATUSES = ['pending', 'in_progress', 'done'] as const;

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
    let statusChangedToDone = false;

    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if (typeof body.description === 'string') data.description = body.description.trim() || null;
    if (typeof body.color === 'string') data.color = body.color.trim() || null;
    if (
      typeof body.status === 'string' &&
      MILESTONE_STATUSES.includes(body.status as (typeof MILESTONE_STATUSES)[number])
    ) {
      data.status = body.status;
      if (body.status === 'done') {
        data.completedAt = new Date();
        statusChangedToDone = true;
      } else {
        data.completedAt = null;
      }
    }
    if (typeof body.dueDate === 'string') {
      data.dueDate = body.dueDate.trim() ? new Date(body.dueDate) : null;
    }
    if (typeof body.progress === 'number' && Number.isFinite(body.progress)) {
      data.progress = clampProgress(body.progress);
    }
    if (typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
      data.sortOrder = Math.trunc(body.sortOrder);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    try {
      const updated = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const existing = await tx.projectMilestone.findFirst({
          where: ctx.where({ id, project: { outsourcingClientId: clientId } }),
          select: { id: true, projectId: true, title: true },
        });
        if (!existing) return null;

        const row = await tx.projectMilestone.update({
          where: { id },
          data,
          include: { _count: { select: { tasks: true } } },
        });

        await logProjectActivity(tx, {
          organizationId: ctx.organizationId,
          projectId: existing.projectId,
          type: 'milestone_changed',
          actorUserId: ctx.staff.id,
          summary: statusChangedToDone
            ? `Milestone "${row.title}" marked done`
            : `Milestone "${row.title}" updated`,
          metadata: { milestoneId: row.id, fields: Object.keys(data) },
        });

        return row;
      });

      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ milestone: serializeMilestone(updated) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/projects/milestones/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update milestone.' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    try {
      const deleted = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const existing = await tx.projectMilestone.findFirst({
          where: ctx.where({ id, project: { outsourcingClientId: clientId } }),
          select: { id: true, projectId: true, title: true },
        });
        if (!existing) return null;

        await tx.projectMilestone.delete({ where: { id } });

        await logProjectActivity(tx, {
          organizationId: ctx.organizationId,
          projectId: existing.projectId,
          type: 'milestone_changed',
          actorUserId: ctx.staff.id,
          summary: `Milestone "${existing.title}" deleted`,
          metadata: { milestoneId: existing.id },
        });

        return existing;
      });

      if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/projects/milestones/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete milestone.' }, { status: 500 });
    }
  });
}
