import { NextRequest, NextResponse } from 'next/server';
import { OnboardingTaskStatus, TaskPriority, TaskRecurrence, WorkflowStatus, WorkflowType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { ensureOperationalWorkflow, getRoleKeysForUser } from '@/lib/onboarding-workflows';
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

function parsePriority(value: unknown): TaskPriority {
  const upper = typeof value === 'string' ? value.toUpperCase() : '';
  return (Object.values(TaskPriority) as string[]).includes(upper)
    ? (upper as TaskPriority)
    : TaskPriority.MEDIUM;
}

function parseRecurrence(value: unknown): TaskRecurrence {
  const upper = typeof value === 'string' ? value.toUpperCase() : '';
  return (Object.values(TaskRecurrence) as string[]).includes(upper)
    ? (upper as TaskRecurrence)
    : TaskRecurrence.NONE;
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope');
    const isManager = canManageOnboarding(ctx.staff);
    // `scope=all` lets HR/managers see every task in the workspace; everyone
    // else (and the legacy `mine=true` param) stays scoped to their own queue.
    const mineOnly = scope === 'all' ? false : scope === 'mine' ? true : url.searchParams.get('mine') === 'true';
    const effectiveMineOnly = mineOnly || !isManager;
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
          OR: [
            { employee: { outsourcingClientId: workspaceClientId } },
            { outsourcingClientId: workspaceClientId },
          ],
        },
      },
    ];

    if (statuses.length > 0) {
      andFilters.push({ status: { in: statuses } });
    }

    if (effectiveMineOnly) {
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
          completedBy: { select: { id: true, name: true, email: true } },
          document: { select: { id: true, fileName: true, title: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
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
      canCreate: isManager,
      canManage: isManager,
      currentUserId: ctx.staff.id,
      roleKeys,
    });
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Creating tasks requires HR privileges.');
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const isOperational = body.type === 'OPERATIONAL' || body.kind === 'operational';
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
    const priority = parsePriority(body.priority);
    const recurrence = isOperational ? parseRecurrence(body.recurrence) : TaskRecurrence.NONE;
    const recurrenceEndsAt = parseDate(body.recurrenceEndsAt);

    if (!title) return NextResponse.json({ error: 'Task name is required' }, { status: 400 });
    if (startDate === undefined && body.startDate !== undefined) {
      return NextResponse.json({ error: 'Invalid start date' }, { status: 400 });
    }
    if (dueDate === undefined && body.dueDate !== undefined) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
    }
    if (recurrenceEndsAt === undefined && body.recurrenceEndsAt !== undefined) {
      return NextResponse.json({ error: 'Invalid recurrence end date' }, { status: 400 });
    }
    // Workflow (onboarding/offboarding) tasks must be assigned to someone;
    // operational tasks may sit in a role pool unassigned.
    if (!isOperational && assigneeIds.length === 0) {
      return NextResponse.json({ error: 'At least one assignee is required' }, { status: 400 });
    }

    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );

    // Validate assignees (if any).
    let assigneeUserIds: string[] = [];
    if (assigneeIds.length > 0) {
      const assignees = await ctx.run((tx) =>
        tx.organizationMembership.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: 'active',
            userId: { in: assigneeIds },
            user: { isActive: true },
          },
          select: { userId: true },
        }),
      );
      if (assignees.length !== assigneeIds.length) {
        return NextResponse.json({ error: 'One or more assignees are invalid' }, { status: 400 });
      }
      assigneeUserIds = assignees.map((a) => a.userId);
    }

    let workflowId: string;
    let participantName: string | null = null;
    let workflowLabel: string;
    let operationalEmployeeId: string | null = null;

    if (isOperational) {
      const rawEmployeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : '';
      if (rawEmployeeId) {
        const emp = await ctx.run((tx) =>
          tx.employee.findFirst({
            where: ctx.where({ id: rawEmployeeId, outsourcingClientId: workspaceClientId }),
            select: { id: true, firstName: true, lastName: true },
          }),
        );
        if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 400 });
        operationalEmployeeId = emp.id;
        participantName = `${emp.firstName} ${emp.lastName}`;
      }
      workflowId = await ctx.run((tx) =>
        ensureOperationalWorkflow(tx, ctx.organizationId, workspaceClientId),
      );
      workflowLabel = 'Operational';
    } else {
      const rawWorkflowId = typeof body.workflowId === 'string' ? body.workflowId : '';
      if (!rawWorkflowId) return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });
      const workflow = await ctx.run((tx) =>
        tx.onboardingWorkflow.findFirst({
          where: ctx.where({ id: rawWorkflowId }),
          include: {
            employee: { select: { outsourcingClientId: true, firstName: true, lastName: true } },
          },
        }),
      );
      if (!workflow || workflow.employee?.outsourcingClientId !== workspaceClientId) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }
      if (workflow.status !== WorkflowStatus.IN_PROGRESS) {
        return NextResponse.json({ error: 'Tasks can only be added to active workflows' }, { status: 409 });
      }
      workflowId = workflow.id;
      participantName = `${workflow.employee!.firstName} ${workflow.employee!.lastName}`;
      workflowLabel = `${workflow.type === WorkflowType.ONBOARDING ? 'Onboarding' : 'Offboarding'} · ${participantName}`;
    }

    const last = await ctx.run((tx) =>
      tx.onboardingTask.findFirst({ where: { workflowId }, orderBy: { order: 'desc' }, select: { order: true } }),
    );
    const nextOrder = (last?.order ?? 0) + 1;

    const targets: (string | null)[] =
      assigneeUserIds.length === 0
        ? [null]
        : createOnePerAssignee
          ? assigneeUserIds
          : [assigneeUserIds[0]!];

    const created = await ctx.run(async (tx) => {
      const rows = [];
      for (let i = 0; i < targets.length; i++) {
        const row = await tx.onboardingTask.create({
          data: {
            organizationId: ctx.organizationId,
            workflowId,
            title,
            description: description || null,
            assignedRole,
            assignedToId: targets[i],
            category: category || null,
            order: nextOrder + i,
            isRequired,
            priority,
            recurrence,
            recurrenceEndsAt: recurrenceEndsAt ?? null,
            employeeId: operationalEmployeeId,
            startDate: startDate === undefined ? new Date() : startDate,
            dueDate: dueDate === undefined ? null : dueDate,
            status: OnboardingTaskStatus.PENDING,
          },
          include: {
            assignedTo: { select: { id: true, name: true, email: true } },
            employee: { select: { id: true, firstName: true, lastName: true } },
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

    const notifyIds = targets.filter((t): t is string => Boolean(t));
    const dueLabel = dueDate ? dueDate.toISOString().slice(0, 10) : 'No due date';
    if (notifyIds.length > 0) {
      try {
        await sendNotification({
          event: 'onboarding_task_assigned',
          recipientUserIds: notifyIds,
          title: 'New task assigned to you',
          body: participantName
            ? `"${title}" for ${participantName} was assigned to you.`
            : `"${title}" was assigned to you.`,
          href: `/dashboard/people/tasks`,
          priority: priority === TaskPriority.URGENT ? 'urgent' : 'action_required',
          channel: 'both',
          metadata: {
            workflowId,
            taskIds: created.map((t) => t.id),
            taskTitle: title,
            participantName: participantName ?? undefined,
            workflowLabel,
            dueLabel,
          },
        });
      } catch (error) {
        console.error('[onboarding] Failed to notify assignees:', error);
      }
    }

    for (const task of created) {
      await ctx.audit({
        action: 'onboarding.task.created',
        entityType: 'OnboardingTask',
        entityId: task.id,
        route: 'POST /api/onboarding/tasks',
        metadata: {
          workflowId,
          operational: isOperational,
          assignedToId: task.assignedToId,
          assignedRole: task.assignedRole,
          priority: task.priority,
          recurrence: task.recurrence,
          title: task.title,
        },
      });
    }

    return NextResponse.json(createOnePerAssignee && created.length > 1 ? created : created[0], {
      status: 201,
    });
  });
}
