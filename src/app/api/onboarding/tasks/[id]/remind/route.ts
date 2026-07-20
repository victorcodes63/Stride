import { NextRequest, NextResponse } from 'next/server';
import { OnboardingTaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { canUserActionTask, getRoleKeysForUser } from '@/lib/onboarding-workflows';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { sendNotification } from '@/lib/notifications';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Nudge the people responsible for a task. Sends an in-app + email reminder to
 * the current assignee, or to everyone in the task's role pool when it is still
 * unclaimed. Available to HR/managers and to anyone able to action the task.
 */
export async function POST(request: NextRequest, context: RouteContext) {
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
          employee: { select: { firstName: true, lastName: true } },
          workflow: {
            include: {
              employee: {
                select: { outsourcingClientId: true, firstName: true, lastName: true },
              },
            },
          },
        },
      }),
    );
    const scopeClientId =
      task?.workflow.employee?.outsourcingClientId ?? task?.workflow.outsourcingClientId ?? null;
    if (!task || scopeClientId !== workspaceClientId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const isManager = canManageOnboarding(ctx.staff);
    const canAction = canUserActionTask(
      { assignedRole: task.assignedRole, assignedToId: task.assignedToId },
      ctx.staff,
    );
    if (!isManager && !canAction) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (task.status === OnboardingTaskStatus.COMPLETED || task.status === OnboardingTaskStatus.SKIPPED) {
      return NextResponse.json({ error: 'This task is already closed.' }, { status: 409 });
    }

    // Resolve who to nudge.
    let recipientUserIds: string[] = [];
    if (task.assignedToId) {
      recipientUserIds = [task.assignedToId];
    } else {
      const memberships = await ctx.run((tx) =>
        tx.organizationMembership.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: 'active',
            user: { isActive: true },
          },
          select: { user: { select: { id: true, role: true, staffUserType: true } } },
        }),
      );
      recipientUserIds = memberships
        .filter((m) => getRoleKeysForUser(m.user).includes(task.assignedRole))
        .map((m) => m.user.id);
    }

    recipientUserIds = [...new Set(recipientUserIds)];
    if (recipientUserIds.length === 0) {
      return NextResponse.json({ error: 'No one is assigned to remind.' }, { status: 409 });
    }

    const emp = task.workflow.employee ?? task.employee;
    const participantName = emp ? `${emp.firstName} ${emp.lastName}` : null;
    const overdue =
      task.status === OnboardingTaskStatus.OVERDUE ||
      Boolean(task.dueDate && task.dueDate.getTime() < Date.now());
    const dueLabel = task.dueDate ? task.dueDate.toISOString().slice(0, 10) : 'No due date';

    try {
      await sendNotification({
        event: overdue ? 'onboarding_task_overdue' : 'onboarding_task_assigned',
        recipientUserIds,
        title: overdue ? 'Reminder: task is overdue' : 'Reminder: task pending',
        body: overdue
          ? `"${task.title}"${participantName ? ` for ${participantName}` : ''} is overdue. Please action it as soon as possible.`
          : `Reminder to complete "${task.title}"${participantName ? ` for ${participantName}` : ''}.`,
        href: '/dashboard/people/tasks',
        priority: overdue ? 'urgent' : 'action_required',
        channel: 'both',
        triggerType: 'manual',
        metadata: {
          workflowId: task.workflowId,
          taskId: task.id,
          taskTitle: task.title,
          participantName: participantName ?? undefined,
          workflowLabel:
            task.workflow.type === 'OPERATIONAL'
              ? 'Operational'
              : `${task.workflow.type === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'}${participantName ? ` · ${participantName}` : ''}`,
          dueLabel,
        },
      });
    } catch (error) {
      console.error('[onboarding] Failed to send reminder:', error);
      return NextResponse.json({ error: 'Could not send reminder.' }, { status: 500 });
    }

    await ctx.audit({
      action: 'onboarding.task.reminded',
      entityType: 'OnboardingTask',
      entityId: task.id,
      route: 'POST /api/onboarding/tasks/[id]/remind',
      metadata: { workflowId: task.workflowId, recipients: recipientUserIds.length, overdue },
    });

    return NextResponse.json({ ok: true, notified: recipientUserIds.length });
  });
}
