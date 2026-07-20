import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { logProjectActivity } from '@/lib/projects/activity';
import { parseProgress } from '@/lib/projects/progress';
import { serializeTask } from '@/lib/projects/serialize';
import { withTenant } from '@/lib/tenant-api';

const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'blocked', 'done'] as const;
const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

/** Walk up the parent chain to ensure `candidateParentId` is not `taskId` or a descendant of it. */
async function wouldCreateSubtaskCycle(
  tx: Prisma.TransactionClient,
  taskId: string,
  candidateParentId: string,
): Promise<boolean> {
  if (taskId === candidateParentId) return true;
  let cursor: string | null = candidateParentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === taskId) return true;
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const parent: { parentTaskId: string | null } | null = await tx.projectTask.findUnique({
      where: { id: cursor },
      select: { parentTaskId: true },
    });
    cursor = parent?.parentTaskId ?? null;
  }
  return false;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const data: Prisma.ProjectTaskUpdateInput = {};
    // Track intent for validation + activity logging.
    let nextStatus: string | undefined;
    let assigneeProvided = false;
    let nextAssigneeId: string | null = null;
    let dueDateProvided = false;
    let milestoneProvided = false;
    let nextMilestoneId: string | null = null;
    let parentProvided = false;
    let nextParentId: string | null = null;

    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if (typeof body.description === 'string') data.description = body.description.trim() || null;
    if (
      typeof body.status === 'string' &&
      TASK_STATUSES.includes(body.status as (typeof TASK_STATUSES)[number])
    ) {
      nextStatus = body.status;
      data.status = body.status as never;
      if (body.status === 'done') {
        data.completedAt = new Date();
        data.progress = 100;
      } else {
        data.completedAt = null;
      }
    }
    if (
      typeof body.priority === 'string' &&
      TASK_PRIORITIES.includes(body.priority as (typeof TASK_PRIORITIES)[number])
    ) {
      data.priority = body.priority as never;
    }
    if (typeof body.assigneeUserId === 'string' || body.assigneeUserId === null) {
      assigneeProvided = true;
      nextAssigneeId =
        typeof body.assigneeUserId === 'string' && body.assigneeUserId.trim()
          ? body.assigneeUserId.trim()
          : null;
      data.assignee = nextAssigneeId ? { connect: { id: nextAssigneeId } } : { disconnect: true };
    }
    if (typeof body.milestoneId === 'string' || body.milestoneId === null) {
      milestoneProvided = true;
      nextMilestoneId =
        typeof body.milestoneId === 'string' && body.milestoneId.trim() ? body.milestoneId.trim() : null;
    }
    if (typeof body.parentTaskId === 'string' || body.parentTaskId === null) {
      parentProvided = true;
      nextParentId =
        typeof body.parentTaskId === 'string' && body.parentTaskId.trim() ? body.parentTaskId.trim() : null;
    }
    if (typeof body.dueDate === 'string') {
      dueDateProvided = true;
      data.dueDate = body.dueDate.trim() ? new Date(body.dueDate) : null;
    }
    if (typeof body.startDate === 'string') {
      data.startDate = body.startDate.trim() ? new Date(body.startDate) : null;
    }
    if (typeof body.estimateHours === 'number' && Number.isFinite(body.estimateHours) && body.estimateHours >= 0) {
      data.estimateHours = body.estimateHours;
    } else if (body.estimateHours === null) {
      data.estimateHours = null;
    }
    // Progress: explicit value clamps; a done status already forces 100 above.
    const parsedProgress = parseProgress(body.progress);
    if (parsedProgress !== undefined && nextStatus !== 'done') {
      data.progress = parsedProgress;
    }
    if (typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
      data.sortOrder = Math.trunc(body.sortOrder);
    }

    const hasChanges =
      Object.keys(data).length > 0 || milestoneProvided || parentProvided;
    if (!hasChanges) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const existing = await tx.projectTask.findFirst({
          where: { id, ...ctx.where(), project: { outsourcingClientId: clientId } },
          select: {
            id: true,
            projectId: true,
            title: true,
            status: true,
            assigneeUserId: true,
            dueDate: true,
            milestoneId: true,
          },
        });
        if (!existing) return { notFound: true as const };

        if (milestoneProvided) {
          if (nextMilestoneId) {
            const milestone = await tx.projectMilestone.findFirst({
              where: { id: nextMilestoneId, projectId: existing.projectId, organizationId: ctx.organizationId },
              select: { id: true },
            });
            if (!milestone) return { badRequest: 'Milestone not found for this project.' as const };
            data.milestone = { connect: { id: nextMilestoneId } };
          } else {
            data.milestone = { disconnect: true };
          }
        }

        if (parentProvided) {
          if (nextParentId) {
            const parent = await tx.projectTask.findFirst({
              where: { id: nextParentId, projectId: existing.projectId, organizationId: ctx.organizationId },
              select: { id: true },
            });
            if (!parent) return { badRequest: 'Parent task not found for this project.' as const };
            if (await wouldCreateSubtaskCycle(tx, existing.id, nextParentId)) {
              return { badRequest: 'Cannot set parent task: would create a cycle.' as const };
            }
            data.parent = { connect: { id: nextParentId } };
          } else {
            data.parent = { disconnect: true };
          }
        }

        const updated = await tx.projectTask.update({
          where: { id },
          data,
          include: {
            project: { select: { id: true, projectCode: true, name: true } },
            milestone: { select: { id: true, title: true } },
            assignee: { select: { id: true, name: true, email: true } },
            taskLabels: { include: { label: true } },
            _count: { select: { subtasks: true, comments: true, attachments: true, blocking: true, blockedBy: true } },
          },
        });

        // Activity trail (best-effort semantics captured atomically).
        if (nextStatus === 'done' && existing.status !== 'done') {
          await logProjectActivity(tx, {
            organizationId: ctx.organizationId,
            projectId: existing.projectId,
            taskId: existing.id,
            type: 'task_completed',
            actorUserId: ctx.staff.id,
            summary: `Task "${updated.title}" completed`,
          });
        } else if (nextStatus && nextStatus !== existing.status) {
          await logProjectActivity(tx, {
            organizationId: ctx.organizationId,
            projectId: existing.projectId,
            taskId: existing.id,
            type: 'status_changed',
            actorUserId: ctx.staff.id,
            summary: `Task "${updated.title}" moved to ${nextStatus}`,
            metadata: { from: existing.status, to: nextStatus },
          });
        }
        if (assigneeProvided && nextAssigneeId !== existing.assigneeUserId) {
          await logProjectActivity(tx, {
            organizationId: ctx.organizationId,
            projectId: existing.projectId,
            taskId: existing.id,
            type: 'assignee_changed',
            actorUserId: ctx.staff.id,
            summary: nextAssigneeId
              ? `Task "${updated.title}" reassigned`
              : `Task "${updated.title}" unassigned`,
            metadata: { from: existing.assigneeUserId, to: nextAssigneeId },
          });
        }
        if (dueDateProvided) {
          const prev = existing.dueDate ? existing.dueDate.toISOString().slice(0, 10) : null;
          const next = data.dueDate ? (data.dueDate as Date).toISOString().slice(0, 10) : null;
          if (prev !== next) {
            await logProjectActivity(tx, {
              organizationId: ctx.organizationId,
              projectId: existing.projectId,
              taskId: existing.id,
              type: 'due_date_changed',
              actorUserId: ctx.staff.id,
              summary: `Task "${updated.title}" due date changed`,
              metadata: { from: prev, to: next },
            });
          }
        }
        if (milestoneProvided && nextMilestoneId !== existing.milestoneId) {
          await logProjectActivity(tx, {
            organizationId: ctx.organizationId,
            projectId: existing.projectId,
            taskId: existing.id,
            type: 'milestone_changed',
            actorUserId: ctx.staff.id,
            summary: `Task "${updated.title}" milestone changed`,
            metadata: { from: existing.milestoneId, to: nextMilestoneId },
          });
        }

        return { task: updated };
      });

      if ('notFound' in result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if ('badRequest' in result) return NextResponse.json({ error: result.badRequest }, { status: 400 });
      return NextResponse.json({ task: serializeTask(result.task) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/projects/tasks/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update task.' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    try {
      const deleted = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const existing = await tx.projectTask.findFirst({
          where: { id, ...ctx.where(), project: { outsourcingClientId: clientId } },
          select: { id: true, projectId: true, title: true },
        });
        if (!existing) return null;

        // Subtasks cascade at the DB level (parent relation onDelete: Cascade).
        await tx.projectTask.delete({ where: { id } });

        await logProjectActivity(tx, {
          organizationId: ctx.organizationId,
          projectId: existing.projectId,
          type: 'updated',
          actorUserId: ctx.staff.id,
          summary: `Task "${existing.title}" deleted`,
          metadata: { taskId: existing.id },
        });

        return existing;
      });

      if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/projects/tasks/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete task.' }, { status: 500 });
    }
  });
}
