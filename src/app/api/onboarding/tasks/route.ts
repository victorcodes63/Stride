import { NextRequest, NextResponse } from 'next/server';
import { OnboardingTaskStatus, WorkflowStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { getRoleKeysForUser } from '@/lib/onboarding-workflows';
import { sendNotification } from '@/lib/notifications';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

const DEFAULT_ROLE = 'hr';

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const url = new URL(request.url);
    const mineOnly = url.searchParams.get('mine') === 'true';
    const q = url.searchParams.get('q')?.trim();
    const statuses = (url.searchParams.get('statuses') ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean) as OnboardingTaskStatus[];

    const roleKeys = getRoleKeysForUser(ctx.staff);
    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );

    const andFilters: Record<string, unknown>[] = [
      ctx.where(),
      {
        workflow: {
          employee: { outsourcingClientId: workspaceClientId },
        },
      },
    ];

    if (statuses.length > 0) {
      andFilters.push({ status: { in: statuses } });
    }

    if (mineOnly) {
      andFilters.push({
        OR: [{ assignedToId: ctx.staff.id }, { assignedRole: { in: roleKeys } }],
      });
    }

    if (q) {
      andFilters.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          {
            workflow: {
              employee: {
                outsourcingClientId: workspaceClientId,
                OR: [
                  { firstName: { contains: q, mode: 'insensitive' } },
                  { lastName: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          },
          {
            assignedTo: {
              name: { contains: q, mode: 'insensitive' },
            },
          },
        ],
      });
    }

    const tasks = await ctx.run((tx) =>
      tx.onboardingTask.findMany({
        where: { AND: andFilters },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          document: { select: { id: true, fileName: true, title: true } },
          workflow: {
            include: {
              employee: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { order: 'asc' }],
      }),
    );

    return NextResponse.json({
      tasks,
      canCreate: canManageOnboarding(ctx.staff),
      currentUserId: ctx.staff.id,
    });
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Creating onboarding tasks requires HR privileges.');
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const workflowId = typeof body.workflowId === 'string' ? body.workflowId : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : undefined;
    const assignedRole =
      typeof body.assignedRole === 'string' && body.assignedRole.trim()
        ? body.assignedRole.trim()
        : DEFAULT_ROLE;
    const category = typeof body.category === 'string' ? body.category.trim() : undefined;
    const isRequired = body.isRequired !== false;
    const createOnePerAssignee = body.createOnePerAssignee === true;
    const assigneeIds = Array.isArray(body.assigneeIds)
      ? [...new Set(body.assigneeIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
      : [];
    const startDate = parseDate(body.startDate);
    const dueDate = parseDate(body.dueDate);

    if (!workflowId) return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });
    if (!title) return NextResponse.json({ error: 'Task name is required' }, { status: 400 });
    if (assigneeIds.length === 0) {
      return NextResponse.json({ error: 'At least one assignee is required' }, { status: 400 });
    }
    if (startDate === undefined && body.startDate !== undefined) {
      return NextResponse.json({ error: 'Invalid start date' }, { status: 400 });
    }
    if (dueDate === undefined && body.dueDate !== undefined) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
    }

    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );

    const workflow = await ctx.run((tx) =>
      tx.onboardingWorkflow.findFirst({
        where: ctx.where({ id: workflowId }),
        include: {
          employee: { select: { outsourcingClientId: true, firstName: true, lastName: true } },
          tasks: { select: { order: true }, orderBy: { order: 'desc' }, take: 1 },
        },
      }),
    );
    if (!workflow || workflow.employee.outsourcingClientId !== workspaceClientId) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }
    if (workflow.status !== WorkflowStatus.IN_PROGRESS) {
      return NextResponse.json({ error: 'Tasks can only be added to active workflows' }, { status: 409 });
    }

    const assignees = await ctx.run((tx) =>
      tx.organizationMembership.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: 'active',
          userId: { in: assigneeIds },
          user: { isActive: true },
        },
        select: { userId: true, user: { select: { id: true, name: true } } },
      }),
    );
    if (assignees.length !== assigneeIds.length) {
      return NextResponse.json({ error: 'One or more assignees are invalid' }, { status: 400 });
    }

    const nextOrder = (workflow.tasks[0]?.order ?? 0) + 1;
    const targetAssignees = createOnePerAssignee
      ? assignees.map((a) => a.userId)
      : [assignees[0]!.userId];

    const created = await ctx.run(async (tx) => {
      const rows = [];
      for (let i = 0; i < targetAssignees.length; i++) {
        const assignedToId = targetAssignees[i]!;
        const row = await tx.onboardingTask.create({
          data: {
            organizationId: ctx.organizationId,
            workflowId,
            title,
            description: description || null,
            assignedRole,
            assignedToId,
            category: category || null,
            order: nextOrder + i,
            isRequired,
            startDate: startDate === undefined ? new Date() : startDate,
            dueDate: dueDate === undefined ? null : dueDate,
            status: OnboardingTaskStatus.PENDING,
          },
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
            workflow: {
              include: {
                employee: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        });
        rows.push(row);
      }
      return rows;
    });

    try {
      await sendNotification({
        event: 'onboarding_task_assigned',
        recipientUserIds: targetAssignees,
        title: 'New onboarding task assigned',
        body: `"${title}" for ${workflow.employee.firstName} ${workflow.employee.lastName} was assigned to you.`,
        href: `/dashboard/people/tasks`,
        priority: 'action_required',
        channel: 'in_app',
        metadata: { workflowId, taskIds: created.map((t) => t.id) },
      });
    } catch (error) {
      console.error('[onboarding] Failed to notify assignees:', error);
    }

    for (const task of created) {
      await ctx.audit({
        action: 'onboarding.task.created',
        entityType: 'OnboardingTask',
        entityId: task.id,
        route: 'POST /api/onboarding/tasks',
        metadata: {
          workflowId,
          assignedToId: task.assignedToId,
          assignedRole: task.assignedRole,
          title: task.title,
        },
      });
    }

    return NextResponse.json(createOnePerAssignee ? created : created[0], {
      status: 201,
    });
  });
}
