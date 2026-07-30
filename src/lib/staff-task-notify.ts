import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export function staffTaskNotificationHref(taskId: string): string {
  return `/dashboard/my-tasks?task=${encodeURIComponent(taskId)}`;
}

export function shouldNotifyTaskAssignee(
  assigneeId: string | null | undefined,
  actorUserId: string,
): assigneeId is string {
  return Boolean(assigneeId && assigneeId !== actorUserId);
}

/** In-app bell notification (call inside a transaction). */
export async function notifyStaffTaskAssignedInApp(
  db: Prisma.TransactionClient | typeof prisma,
  params: {
    organizationId: string;
    assigneeId: string;
    assignerName: string;
    taskTitle: string;
    taskId: string;
    dueAt?: Date | null;
  },
): Promise<void> {
  const dueLine =
    params.dueAt != null
      ? ` Due ${params.dueAt.toLocaleDateString('en-KE', { dateStyle: 'medium' })}.`
      : '';
  await db.staffNotification.create({
    data: {
      organizationId: params.organizationId,
      userId: params.assigneeId,
      title: 'Task assigned to you',
      body: `${params.assignerName} assigned you: ${params.taskTitle}.${dueLine}`,
      href: staffTaskNotificationHref(params.taskId),
      event: 'staff_task.assigned',
      priority: 'info',
    },
  });
}

export async function notifyStaffTaskAssigned(
  db: Prisma.TransactionClient | typeof prisma,
  params: {
    organizationId: string;
    assigneeId: string;
    assignerName: string;
    taskTitle: string;
    taskId: string;
    dueAt?: Date | null;
  },
): Promise<void> {
  await notifyStaffTaskAssignedInApp(db, params);
}

/** In-app notifications when a task is marked done (assignee + creator, excluding the completer). */
export async function notifyStaffTaskCompletedParties(
  db: Prisma.TransactionClient | typeof prisma,
  params: {
    organizationId: string;
    completerUserId: string;
    completerName: string;
    taskTitle: string;
    taskId: string;
    assigneeId: string | null;
    createdById: string;
  },
): Promise<void> {
  const href = staffTaskNotificationHref(params.taskId);

  if (params.assigneeId && params.assigneeId !== params.completerUserId) {
    await db.staffNotification.create({
      data: {
        organizationId: params.organizationId,
        userId: params.assigneeId,
        title: 'Task completed',
        body: `${params.completerName} marked complete: ${params.taskTitle}`,
        href,
        event: 'staff_task.completed',
        priority: 'info',
      },
    });
  }

  if (params.createdById !== params.completerUserId) {
    await db.staffNotification.create({
      data: {
        organizationId: params.organizationId,
        userId: params.createdById,
        title: 'Task completed',
        body: `${params.completerName} completed: ${params.taskTitle}`,
        href,
        event: 'staff_task.completed',
        priority: 'info',
      },
    });
  }
}
