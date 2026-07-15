import { NextRequest, NextResponse } from 'next/server';
import { OnboardingTaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import {
  canUserActionTask,
  getTaskDependencyBlocker,
  maybeCompleteWorkflow,
  refreshWorkflowTaskSLAs,
} from '@/lib/onboarding-workflows';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { sendNotification } from '@/lib/notifications';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

function isDocumentsCategory(category: string | null | undefined): boolean {
  return (category ?? '').toLowerCase() === 'documents';
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
          assignedTo: { select: { id: true, name: true, email: true } },
          completedBy: { select: { id: true, name: true, email: true } },
          document: { select: { id: true, fileName: true, title: true, filePath: true } },
        },
      }),
    );
    if (!task || task.workflow.employee.outsourcingClientId !== workspaceClientId) {
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
    if (!existing || existing.workflow.employee.outsourcingClientId !== workspaceClientId) {
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
        const doc = await ctx.run((tx) =>
          tx.employeeDocument.findFirst({
            where: ctx.where({
              id: body.documentId as string,
              employeeId: existing.workflow.employeeId,
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

    if (
      nextAssignedToId &&
      nextAssignedToId !== existing.assignedToId &&
      nextAssignedToId !== ctx.staff.id
    ) {
      try {
        await sendNotification({
          event: 'onboarding_task_assigned',
          recipientUserIds: [nextAssignedToId],
          title: 'Onboarding task assigned',
          body: `"${existing.title}" for ${existing.workflow.employee.firstName} ${existing.workflow.employee.lastName} was assigned to you.`,
          href: `/dashboard/people/tasks`,
          priority: 'action_required',
          channel: 'in_app',
          metadata: { workflowId: existing.workflowId, taskId: existing.id },
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
