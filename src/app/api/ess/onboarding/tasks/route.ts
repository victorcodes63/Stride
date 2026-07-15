import { NextRequest, NextResponse } from 'next/server';
import { WorkflowStatus } from '@prisma/client';
import { withEssTenant } from '@/lib/ess-tenant-api';

function isOpenStatus(status: string) {
  return status !== 'COMPLETED' && status !== 'SKIPPED';
}

function isOverdue(status: string, dueDate: Date | null) {
  if (!isOpenStatus(status)) return false;
  if (status === 'OVERDUE') return true;
  if (!dueDate) return false;
  return dueDate.getTime() < Date.now();
}

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ items: [], workflowStatus: null, summary: null });

    const workflow = await ctx.run((tx) =>
      tx.onboardingWorkflow.findFirst({
        where: {
          ...ctx.where(),
          employeeId: ctx.employeeId!,
          status: WorkflowStatus.IN_PROGRESS,
        },
        include: {
          tasks: {
            orderBy: { order: 'asc' },
            include: {
              document: { select: { id: true, fileName: true, title: true } },
            },
          },
          template: { select: { name: true } },
        },
      }),
    );

    if (!workflow) {
      return NextResponse.json({ items: [], workflowStatus: null, summary: null });
    }

    const employeeTasks = workflow.tasks.filter((t) => t.assignedRole === 'employee');
    const items = employeeTasks.map((t) => {
      const overdue = isOverdue(t.status, t.dueDate);
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        startDate: t.startDate?.toISOString() ?? null,
        dueDate: t.dueDate?.toISOString() ?? null,
        isRequired: t.isRequired,
        order: t.order,
        category: t.category,
        documentId: t.documentId,
        document: t.document,
        overdue,
        needsEvidence:
          (t.category ?? '').toLowerCase() === 'documents' &&
          isOpenStatus(t.status) &&
          !t.documentId,
      };
    });

    const open = items.filter((t) => isOpenStatus(t.status));
    const summary = {
      totalOpen: open.length,
      due: open.filter((t) => t.dueDate && !t.overdue).length,
      overdue: open.filter((t) => t.overdue).length,
      noDue: open.filter((t) => !t.dueDate).length,
      completed: items.filter((t) => t.status === 'COMPLETED').length,
      total: items.length,
    };

    return NextResponse.json({
      workflowId: workflow.id,
      workflowStatus: workflow.status,
      workflowType: workflow.type,
      templateName: workflow.template.name,
      summary,
      items,
    });
  });
}
