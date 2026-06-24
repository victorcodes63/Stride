import { NextRequest, NextResponse } from 'next/server';
import { OnboardingTaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get('secret') === secret;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const now = new Date();

  const overdueTasks = await prisma.onboardingTask.findMany({
    where: { status: OnboardingTaskStatus.PENDING, dueDate: { lt: now } },
    include: {
      workflow: { include: { employee: { select: { firstName: true, lastName: true } } } },
    },
  });

  for (const task of overdueTasks) {
    await prisma.onboardingTask.update({
      where: { id: task.id },
      data: { status: OnboardingTaskStatus.OVERDUE },
    });

    const roleUsers = await prisma.user.findMany({
      where: { isActive: true, OR: [{ role: 'admin' }, { staffUserType: 'operations' }] },
      select: { id: true },
    });
    const recipients = task.assignedToId ? [task.assignedToId] : roleUsers.map((item) => item.id);
    if (recipients.length === 0) continue;

    await sendNotification({
      event: 'employee_created',
      recipientUserIds: recipients,
      title: 'Overdue onboarding task',
      body: `"${task.title}" for ${task.workflow.employee.firstName} ${task.workflow.employee.lastName} was due on ${task.dueDate?.toISOString().slice(0, 10)}.`,
      href: `/dashboard/onboarding/${task.workflowId}`,
      priority: 'urgent',
      channel: 'in_app',
    });
  }

  return NextResponse.json({ ok: true, updated: overdueTasks.length });
}
