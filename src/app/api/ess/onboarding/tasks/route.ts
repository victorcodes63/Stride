import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ items: [], workflowStatus: null });

  const workflow = await prisma.onboardingWorkflow.findFirst({
    where: { employeeId: user.employeeId, status: 'IN_PROGRESS' },
    include: {
      tasks: { orderBy: { order: 'asc' } },
      template: { select: { name: true } },
    },
  });

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
}
