import { NextRequest, NextResponse } from 'next/server';
import { OnboardingTaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canUserActionTask,
  getTaskDependencyBlocker,
  maybeCompleteWorkflow,
  refreshWorkflowTaskSLAs,
} from '@/lib/onboarding-workflows';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { logAuditEvent } from '@/lib/audit-events';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const task = await prisma.onboardingTask.findUnique({
    where: { id },
    include: {
      workflow: { include: { employee: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      completedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (task.workflow.employee.outsourcingClientId !== workspaceClientId) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }
  return NextResponse.json(task);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const status = body.status as OnboardingTaskStatus | undefined;
  const nextStatus = status ?? undefined;
  const existing = await prisma.onboardingTask.findUnique({
    where: { id },
    include: {
      workflow: {
        include: {
          employee: { select: { outsourcingClientId: true } },
          tasks: true,
        },
      },
    },
  });
  if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (existing.workflow.employee.outsourcingClientId !== workspaceClientId) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }
  if (!canUserActionTask({ assignedRole: existing.assignedRole, assignedToId: existing.assignedToId }, user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (nextStatus === OnboardingTaskStatus.COMPLETED) {
    const blocker = getTaskDependencyBlocker({
      workflowType: existing.workflow.type,
      targetTask: existing,
      tasks: existing.workflow.tasks,
    });
    if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  }

  const task = await prisma.onboardingTask.update({
    where: { id },
    data: {
      status: nextStatus,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      completedAt:
        nextStatus === OnboardingTaskStatus.COMPLETED || nextStatus === OnboardingTaskStatus.SKIPPED ? new Date() : null,
      completedById:
        nextStatus === OnboardingTaskStatus.COMPLETED || nextStatus === OnboardingTaskStatus.SKIPPED ? user.id : null,
    },
  });

  await refreshWorkflowTaskSLAs(task.workflowId);
  await maybeCompleteWorkflow(task.workflowId);
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
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
}
