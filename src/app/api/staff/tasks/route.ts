import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { canAccessCompanyTasks } from '@/lib/staff-api-auth';
import {
  parseDueAt,
  parseStaffTaskPriority,
  parseStaffTaskStatus,
  staffTaskInclude,
} from '@/lib/staff-task-api';
import {
  notifyStaffTaskAssignedInApp,
  shouldNotifyTaskAssignee,
} from '@/lib/staff-task-notify';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const scope = request.nextUrl.searchParams.get('scope') || 'assigned_to_me';
    const statusFilter = request.nextUrl.searchParams.get('status');
    const dueFilter = request.nextUrl.searchParams.get('due');

    const where: Prisma.StaffTaskWhereInput = {};

    if ((scope === 'all' || scope === 'company') && canAccessCompanyTasks(ctx.staff)) {
      // company-wide within tenant
    } else if (scope === 'all' || scope === 'company') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else if (scope === 'created_by_me') {
      where.createdById = ctx.staff.id;
    } else {
      where.assigneeId = ctx.staff.id;
    }

    if (statusFilter === 'active') {
      where.status = { in: ['todo', 'in_progress'] };
    } else if (statusFilter === 'done') {
      where.status = 'done';
    } else {
      const parsed = parseStaffTaskStatus(statusFilter);
      if (parsed) where.status = parsed;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    if (dueFilter === 'today') {
      where.dueAt = { gte: startOfToday, lt: endOfToday };
      where.status = { in: ['todo', 'in_progress'] };
    } else if (dueFilter === 'overdue') {
      where.dueAt = { lt: startOfToday };
      where.status = { in: ['todo', 'in_progress'] };
    } else if (dueFilter === 'upcoming') {
      where.dueAt = { gte: endOfToday };
      where.status = { in: ['todo', 'in_progress'] };
    } else if (dueFilter === 'no_date') {
      where.dueAt = null;
      where.status = { in: ['todo', 'in_progress'] };
    }

    const list = await ctx.run((tx) =>
      tx.staffTask.findMany({
        where: ctx.where(where),
        include: staffTaskInclude,
        orderBy:
          dueFilter === 'today' || dueFilter === 'overdue' || dueFilter === 'upcoming'
            ? [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }]
            : [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        take: 300,
      }),
    );

    return NextResponse.json(list);
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const title = String(body.title || '').trim();
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

    const description =
      body.description != null ? String(body.description).trim() || null : null;
    const priority = parseStaffTaskPriority(body.priority) ?? 'none';
    const status = parseStaffTaskStatus(body.status) ?? 'todo';
    const dueAt = parseDueAt(body.dueAt) ?? null;

    let assigneeId: string | null = null;
    if (body.assigneeId != null && body.assigneeId !== '') {
      assigneeId = String(body.assigneeId).trim();
      const assignee = await ctx.run((tx) =>
        tx.organizationMembership.findFirst({
          where: {
            organizationId: ctx.organizationId,
            userId: assigneeId!,
            status: 'active',
            user: { isActive: true },
          },
          select: { userId: true },
        }),
      );
      if (!assignee) {
        return NextResponse.json({ error: 'Assignee not found or inactive' }, { status: 400 });
      }
    } else if (body.assignToMe === true) {
      assigneeId = ctx.staff.id;
    }

    const completedAt = status === 'done' ? new Date() : null;
    const notifyAssign = shouldNotifyTaskAssignee(assigneeId, ctx.staff.id);

    const task = await ctx.run(async (tx) => {
      const created = await tx.staffTask.create({
        data: {
          organizationId: ctx.organizationId,
          title,
          description,
          priority,
          status,
          dueAt,
          completedAt,
          createdById: ctx.staff.id,
          assigneeId,
        },
        include: staffTaskInclude,
      });
      if (notifyAssign && assigneeId) {
        await notifyStaffTaskAssignedInApp(tx, {
          organizationId: ctx.organizationId,
          assigneeId,
          assignerName: ctx.staff.name,
          taskTitle: title,
          taskId: created.id,
          dueAt,
        });
      }
      return created;
    });

    return NextResponse.json(task);
  });
}
