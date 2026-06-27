import { NextRequest, NextResponse } from 'next/server';
import { OnboardingTaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  canUserActionTask,
  getTaskDependencyBlocker,
  maybeCompleteWorkflow,
  refreshWorkflowTaskSLAs,
} from '@/lib/onboarding-workflows';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

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

    const existing = await ctx.run((tx) =>
      tx.onboardingTask.findFirst({
        where: ctx.where({ id }),
        include: {
          workflow: {
            include: {
              employee: { select: { outsourcingClientId: true } },
              tasks: true,
            },
          },
        },
      }),
    );
    if (!existing || existing.workflow.employee.outsourcingClientId !== workspaceClientId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    if (
      !canUserActionTask(
        { assignedRole: existing.assignedRole, assignedToId: existing.assignedToId },
        ctx.staff,
      )
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (status === OnboardingTaskStatus.COMPLETED) {
      const blocker = getTaskDependencyBlocker({
        workflowType: existing.workflow.type,
        targetTask: existing,
        tasks: existing.workflow.tasks,
      });
      if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
    }

    const task = await ctx.run((tx) =>
      tx.onboardingTask.update({
        where: { id },
        data: {
          status,
          notes: typeof body.notes === 'string' ? body.notes : undefined,
          completedAt:
            status === OnboardingTaskStatus.COMPLETED || status === OnboardingTaskStatus.SKIPPED
              ? new Date()
              : null,
          completedById:
            status === OnboardingTaskStatus.COMPLETED || status === OnboardingTaskStatus.SKIPPED
              ? ctx.staff.id
              : null,
        },
      }),
    );

    await refreshWorkflowTaskSLAs(task.workflowId);
    await maybeCompleteWorkflow(task.workflowId);

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
      },
    });

    return NextResponse.json(task);
  });
}
