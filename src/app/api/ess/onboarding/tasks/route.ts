import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ items: [], workflowStatus: null });

    const workflow = await ctx.run((tx) =>
      tx.onboardingWorkflow.findFirst({
        where: ctx.where({ employeeId: ctx.employeeId!, status: 'IN_PROGRESS' }),
        include: {
          tasks: { orderBy: { order: 'asc' } },
          template: { select: { name: true } },
        },
      }),
    );

    if (!workflow) {
      return NextResponse.json({ items: [], workflowStatus: null });
    }

    return NextResponse.json({
      workflowStatus: workflow.status,
      templateName: workflow.template.name,
      items: workflow.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        dueDate: t.dueDate?.toISOString() ?? null,
        isRequired: t.isRequired,
        order: t.order,
      })),
    });
  });
}
