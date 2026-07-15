import { NextRequest, NextResponse } from 'next/server';
import { OnboardingTaskStatus } from '@prisma/client';
import {
  getTaskDependencyBlocker,
  maybeCompleteWorkflow,
  refreshWorkflowTaskSLAs,
} from '@/lib/onboarding-workflows';
import { withEssTenant } from '@/lib/ess-tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

function serializeTask(task: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  startDate: Date | null;
  dueDate: Date | null;
  isRequired: boolean;
  order: number;
  category: string | null;
  notes: string | null;
  documentId: string | null;
  document?: { id: string; fileName: string; title: string } | null;
}) {
  const open = task.status !== 'COMPLETED' && task.status !== 'SKIPPED';
  const overdue =
    open &&
    (task.status === 'OVERDUE' || (task.dueDate != null && task.dueDate.getTime() < Date.now()));
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    startDate: task.startDate?.toISOString() ?? null,
    dueDate: task.dueDate?.toISOString() ?? null,
    isRequired: task.isRequired,
    order: task.order,
    category: task.category,
    notes: task.notes,
    documentId: task.documentId,
    document: task.document ?? null,
    overdue,
    needsEvidence:
      (task.category ?? '').toLowerCase() === 'documents' && open && !task.documentId,
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withEssTenant(_request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ error: 'No employee profile.' }, { status: 400 });

    const task = await ctx.run((tx) =>
      tx.onboardingTask.findFirst({
        where: {
          id,
          ...ctx.where(),
          assignedRole: 'employee',
          workflow: { employeeId: ctx.employeeId! },
        },
        include: {
          document: { select: { id: true, fileName: true, title: true } },
          workflow: {
            select: {
              id: true,
              type: true,
              status: true,
              template: { select: { name: true } },
            },
          },
        },
      }),
    );
    if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });

    return NextResponse.json({
      ...serializeTask(task),
      workflow: {
        id: task.workflow.id,
        type: task.workflow.type,
        status: task.workflow.status,
        templateName: task.workflow.template.name,
      },
    });
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ error: 'No employee profile.' }, { status: 400 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }
    const status = (body as { status?: string }).status;
    if (status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Only marking complete is supported.' }, { status: 400 });
    }

    const task = await ctx.run((tx) =>
      tx.onboardingTask.findFirst({
        where: {
          id,
          ...ctx.where(),
          workflow: { employeeId: ctx.employeeId! },
        },
        include: {
          workflow: {
            include: {
              tasks: true,
            },
          },
        },
      }),
    );
    if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });

    if (task.assignedRole !== 'employee') {
      return NextResponse.json(
        { error: 'You can only complete tasks assigned to the employee.' },
        { status: 403 },
      );
    }

    const blocker = getTaskDependencyBlocker({
      workflowType: task.workflow.type,
      targetTask: task,
      tasks: task.workflow.tasks,
    });
    if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });

    if ((task.category ?? '').toLowerCase() === 'documents' && !task.documentId) {
      return NextResponse.json(
        { error: 'Attach a PDF before completing this Documents task.' },
        { status: 409 },
      );
    }

    const notes =
      typeof (body as { notes?: string }).notes === 'string'
        ? (body as { notes: string }).notes
        : task.notes;

    const updated = await ctx.run((tx) =>
      tx.onboardingTask.update({
        where: { id },
        data: {
          status: OnboardingTaskStatus.COMPLETED,
          completedAt: new Date(),
          notes,
        },
        include: {
          document: { select: { id: true, fileName: true, title: true } },
        },
      }),
    );

    await refreshWorkflowTaskSLAs(task.workflowId);
    await maybeCompleteWorkflow(task.workflowId);

    await ctx.audit({
      action: 'ess.onboarding.task.completed',
      entityType: 'OnboardingTask',
      entityId: updated.id,
      route: 'PATCH /api/ess/onboarding/tasks/[id]',
      metadata: {
        workflowId: task.workflowId,
        previousStatus: task.status,
        status: updated.status,
        essUserId: ctx.essUser.id,
      },
    });

    return NextResponse.json(serializeTask(updated));
  });
}
