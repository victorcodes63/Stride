import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeTask } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'blocked', 'done'] as const;
const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

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
      typeof body.status === 'string' &&
      TASK_STATUSES.includes(body.status as (typeof TASK_STATUSES)[number])
    ) {
      data.status = body.status;
      data.completedAt = body.status === 'done' ? new Date() : null;
    }
    if (
      typeof body.priority === 'string' &&
      TASK_PRIORITIES.includes(body.priority as (typeof TASK_PRIORITIES)[number])
    ) {
      data.priority = body.priority;
    }
    if (typeof body.assigneeUserId === 'string') {
      data.assigneeUserId = body.assigneeUserId.trim() || null;
    }
    if (typeof body.milestoneId === 'string') {
      data.milestoneId = body.milestoneId.trim() || null;
    }
    if (typeof body.dueDate === 'string') {
      data.dueDate = body.dueDate.trim() ? new Date(body.dueDate) : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    try {
      const updated = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const existing = await tx.projectTask.findFirst({
          where: { id, ...ctx.where(), project: { outsourcingClientId: clientId } },
          select: { id: true },
        });
        if (!existing) return null;

        return tx.projectTask.update({
          where: { id },
          data,
          include: {
            project: { select: { id: true, projectCode: true, name: true } },
            milestone: { select: { id: true, title: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
        });
      });

      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ task: serializeTask(updated) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/projects/tasks/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update task.' }, { status: 500 });
    }
  });
}
