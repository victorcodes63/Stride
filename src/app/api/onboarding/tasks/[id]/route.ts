import { NextRequest, NextResponse } from 'next/server';
import { OnboardingTaskStatus, TaskPriority } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import {
  canUserActionTask,
  getTaskDependencyBlocker,
  maybeCompleteWorkflow,
  refreshWorkflowTaskSLAs,
  spawnRecurrenceFollowUp,
} from '@/lib/onboarding-workflows';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { sendNotification } from '@/lib/notifications';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

function isDocumentsCategory(category: string | null | undefined): boolean {
  return (category ?? '').toLowerCase() === 'documents';
}

/** A task's workspace client comes from its participant, or the operational bucket. */
function workflowScopeClientId(workflow: {
  employee?: { outsourcingClientId?: string | null } | null;
  outsourcingClientId?: string | null;
}): string | null {
  return workflow.employee?.outsourcingClientId ?? workflow.outsourcingClientId ?? null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );

    const task = await ctx.run((tx) =>
      tx.onboardingTask.findFirst({
        where: ctx.where({ id }),
        include: {
          workflow: { include: { employee: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          completedBy: { select: { id: true, name: true, email: true } },
          document: { select: { id: true, fileName: true, title: true, filePath: true } },
        },
      }),
    );
    if (!task || workflowScopeClientId(task.workflow) !== workspaceClientId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json(task);
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );
    const status = body.status as OnboardingTaskStatus | undefined;
    const claim = body.claim === true;
    const assignedToIdProvided = Object.prototype.hasOwnProperty.call(body, 'assignedToId');
    const documentIdProvided = Object.prototype.hasOwnProperty.call(body, 'documentId');
    const nextPriority =
      typeof body.priority === 'string' &&
      (Object.values(TaskPriority) as string[]).includes(body.priority.toUpperCase())
        ? (body.priority.toUpperCase() as TaskPriority)
        : undefined;

    const existing = await ctx.run((tx) =>
      tx.onboardingTask.findFirst({
        where: ctx.where({ id }),
        include: {
          workflow: {
            include: {
              employee: { select: { outsourcingClientId: true, firstName: true, lastName: true } },
              tasks: true,
            },
          },
        },
      }),
    );
    if (!existing || workflowScopeClientId(existing.workflow) !== workspaceClientId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const canAction = canUserActionTask(
      { assignedRole: existing.assignedRole, assignedToId: existing.assignedToId },
      ctx.staff,
    );
    const isManager = canManageOnboarding(ctx.staff);

    if (!canAction && !(isManager && (assignedToIdProvided || claim))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let nextAssignedToId: string | null | undefined = undefined;
    if (claim) {
      nextAssignedToId = ctx.staff.id;
    } else if (assignedToIdProvided) {
      if (!isManager) {
        return NextResponse.json({ error: 'Only HR can reassign tasks' }, { status: 403 });
      }
      if (body.assignedToId === null || body.assignedToId === '') {
        nextAssignedToId = null;
      } else if (typeof body.assignedToId === 'string') {
        const membership = await ctx.run((tx) =>
          tx.organizationMembership.findFirst({
            where: {
              organizationId: ctx.organizationId,
              status: 'active',
              userId: body.assignedToId as string,
              user: { isActive: true },
            },
            select: { userId: true },
          }),
        );
        if (!membership) {
          return NextResponse.json({ error: 'Assignee not found' }, { status: 400 });
        }
        nextAssignedToId = membership.userId;
      } else {
        return NextResponse.json({ error: 'Invalid assignedToId' }, { status: 400 });
      }
    }

    let nextDocumentId: string | null | undefined = undefined;
    if (documentIdProvided) {
      if (body.documentId === null || body.documentId === '') {
        nextDocumentId = null;
      } else if (typeof body.documentId === 'string') {
        const targetEmployeeId = existing.workflow.employeeId ?? existing.employeeId;
        if (!targetEmployeeId) {
          return NextResponse.json(
            { error: 'Documents can only be linked to tasks tied to an employee.' },
            { status: 400 },
          );
        }
        const doc = await ctx.run((tx) =>
          tx.employeeDocument.findFirst({
            where: ctx.where({
              id: body.documentId as string,
              employeeId: targetEmployeeId,
            }),
            select: { id: true },
          }),
        );
        if (!doc) return NextResponse.json({ error: 'Document not found for this employee' }, { status: 400 });
        nextDocumentId = doc.id;
      } else {
        return NextResponse.json({ error: 'Invalid documentId' }, { status: 400 });
      }
    }

    const effectiveDocumentId =
      nextDocumentId !== undefined ? nextDocumentId : existing.documentId;

    if (status === OnboardingTaskStatus.COMPLETED) {
      const blocker = getTaskDependencyBlocker({
        workflowType: existing.workflow.type,
        targetTask: existing,
        tasks: existing.workflow.tasks,
      });
      if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });

      if (isDocumentsCategory(existing.category) && !effectiveDocumentId) {
        return NextResponse.json(
          { error: 'Attach evidence (document) before completing this Documents task.' },
          { status: 409 },
        );
      }
    }

    let nextStatus = status;
    if (
      !nextStatus &&
      (claim || (nextAssignedToId && nextAssignedToId !== existing.assignedToId)) &&
      (existing.status === OnboardingTaskStatus.PENDING || existing.status === OnboardingTaskStatus.OVERDUE)
    ) {
      nextStatus = OnboardingTaskStatus.IN_PROGRESS;
    }

    const task = await ctx.run((tx) =>
      tx.onboardingTask.update({
        where: { id },
        data: {
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(typeof body.notes === 'string' ? { notes: body.notes } : {}),
          ...(nextAssignedToId !== undefined ? { assignedToId: nextAssignedToId } : {}),
          ...(nextDocumentId !== undefined ? { documentId: nextDocumentId } : {}),
          ...(nextPriority ? { priority: nextPriority } : {}),
          completedAt:
            nextStatus === OnboardingTaskStatus.COMPLETED || nextStatus === OnboardingTaskStatus.SKIPPED
              ? new Date()
              : nextStatus
                ? null
                : undefined,
          completedById:
            nextStatus === OnboardingTaskStatus.COMPLETED || nextStatus === OnboardingTaskStatus.SKIPPED
              ? ctx.staff.id
              : nextStatus
                ? null
                : undefined,
        },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          document: { select: { id: true, fileName: true, title: true } },
        },
      }),
    );

    await refreshWorkflowTaskSLAs(task.workflowId);
    await maybeCompleteWorkflow(task.workflowId);

    // Recurring tasks spawn their next occurrence once completed.
    if (nextStatus === OnboardingTaskStatus.COMPLETED) {
      try {
        await spawnRecurrenceFollowUp(task.id);
      } catch (error) {
        console.error('[onboarding] Failed to spawn recurrence follow-up:', error);
      }
    }

    if (
      nextAssignedToId &&
      nextAssignedToId !== existing.assignedToId &&
      nextAssignedToId !== ctx.staff.id
    ) {
      const emp = existing.workflow.employee;
      const participantName = emp ? `${emp.firstName} ${emp.lastName}` : null;
      const workflowLabel =
        existing.workflow.type === 'OPERATIONAL'
          ? 'Operational'
          : `${existing.workflow.type === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'}${participantName ? ` · ${participantName}` : ''}`;
      try {
        await sendNotification({
          event: 'onboarding_task_assigned',
          recipientUserIds: [nextAssignedToId],
          title: 'A task was assigned to you',
          body: participantName
            ? `"${existing.title}" for ${participantName} was assigned to you.`
            : `"${existing.title}" was assigned to you.`,
          href: `/dashboard/people/tasks`,
          priority: 'action_required',
          channel: 'both',
          metadata: {
            workflowId: existing.workflowId,
            taskId: existing.id,
            taskTitle: existing.title,
            participantName: participantName ?? undefined,
            workflowLabel,
            dueLabel: existing.dueDate ? existing.dueDate.toISOString().slice(0, 10) : 'No due date',
          },
        });
      } catch (error) {
        console.error('[onboarding] Failed to notify reassigned user:', error);
      }
    }

    await ctx.audit({
      action: 'onboarding.task.updated',
      entityType: 'OnboardingTask',
      entityId: task.id,
      route: 'PUT /api/onboarding/tasks/[id]',
      metadata: {
        workflowId: task.workflowId,
        previousStatus: existing.status,
        status: task.status,
        assignedRole: task.assignedRole,
        assignedToId: task.assignedToId,
        documentId: task.documentId,
        claimed: claim,
      },
    });

    return NextResponse.json(task);
  });
}
