import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import {
  canDeleteStaffTask,
  canEditStaffTask,
  canViewStaffTask,
} from '@/lib/staff-task-access';
import {
  parseDueAt,
  parseStaffTaskPriority,
  parseStaffTaskStatus,
  staffTaskInclude,
  statusSetsCompletedAt,
} from '@/lib/staff-task-api';
import {
  notifyStaffTaskAssignedInApp,
  notifyStaffTaskCompletedParties,
  shouldNotifyTaskAssignee,
} from '@/lib/staff-task-notify';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    const task = await ctx.run((tx) =>
      tx.staffTask.findFirst({
        where: ctx.where({ id }),
        include: staffTaskInclude,
      }),
    );
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canViewStaffTask(ctx.staff, task)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(task);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const existing = await ctx.run((tx) =>
      tx.staffTask.findFirst({ where: ctx.where({ id }) }),
    );
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canEditStaffTask(ctx.staff, existing)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data: Prisma.StaffTaskUpdateInput = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 });
      data.title = title;
    }
    if (body.description !== undefined) {
      data.description = String(body.description).trim() || null;
    }
    if (body.priority !== undefined) {
      const priority = parseStaffTaskPriority(body.priority);
      if (!priority) return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
      data.priority = priority;
    }
    if (body.status !== undefined) {
      const status = parseStaffTaskStatus(body.status);
      if (!status) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      data.status = status;
      Object.assign(data, statusSetsCompletedAt(status, existing.status));
    }
    if (body.dueAt !== undefined) {
      data.dueAt = parseDueAt(body.dueAt);
    }

    let notifyAssign: { assigneeId: string; taskTitle: string; dueAt: Date | null } | null = null;
    let notifyOnComplete = false;

    if (body.assigneeId !== undefined) {
      if (body.assigneeId === null || body.assigneeId === '') {
        data.assignee = { disconnect: true };
      } else {
        const assigneeId = String(body.assigneeId).trim();
        const assignee = await ctx.run((tx) =>
          tx.organizationMembership.findFirst({
            where: {
              organizationId: ctx.organizationId,
              userId: assigneeId,
              status: 'active',
              user: { isActive: true },
            },
            select: { userId: true },
          }),
        );
        if (!assignee) {
          return NextResponse.json({ error: 'Assignee not found or inactive' }, { status: 400 });
        }
        data.assignee = { connect: { id: assigneeId } };
        if (shouldNotifyTaskAssignee(assigneeId, ctx.staff.id) && assigneeId !== existing.assigneeId) {
          const dueAt =
            body.dueAt !== undefined ? (parseDueAt(body.dueAt) ?? null) : existing.dueAt;
          notifyAssign = {
            assigneeId,
            taskTitle: String(data.title ?? existing.title),
            dueAt,
          };
        }
      }
    }

    if (body.action === 'complete') {
      data.status = 'done';
      Object.assign(data, statusSetsCompletedAt('done', existing.status));
    } else if (body.action === 'reopen') {
      data.status = 'todo';
      Object.assign(data, statusSetsCompletedAt('todo', existing.status));
    }

    const willBeDone = data.status === 'done' || body.action === 'complete';
    if (willBeDone && existing.status !== 'done') {
      notifyOnComplete = true;
    }

    const updated = await ctx.run(async (tx) => {
      const row = await tx.staffTask.update({
        where: { id },
        data,
        include: staffTaskInclude,
      });
      if (notifyAssign) {
        await notifyStaffTaskAssignedInApp(tx, {
          organizationId: ctx.organizationId,
          assigneeId: notifyAssign.assigneeId,
          assignerName: ctx.staff.name,
          taskTitle: notifyAssign.taskTitle,
          taskId: id,
          dueAt: notifyAssign.dueAt,
        });
      }
      if (notifyOnComplete) {
        await notifyStaffTaskCompletedParties(tx, {
          organizationId: ctx.organizationId,
          completerUserId: ctx.staff.id,
          completerName: ctx.staff.name,
          taskTitle: row.title,
          taskId: id,
          assigneeId: row.assigneeId,
          createdById: row.createdById,
        });
      }
      if (row.status === 'done') {
        await tx.personalCalendarEvent.updateMany({
          where: {
            organizationId: ctx.organizationId,
            linkedTaskId: id,
            status: 'scheduled',
          },
          data: { status: 'cancelled' },
        });
      }
      return row;
    });

    return NextResponse.json(updated);
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    const existing = await ctx.run((tx) =>
      tx.staffTask.findFirst({ where: ctx.where({ id }) }),
    );
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canDeleteStaffTask(ctx.staff, existing)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ctx.run((tx) => tx.staffTask.delete({ where: { id } }));
    return NextResponse.json({ ok: true });
  });
}
