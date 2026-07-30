import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type StaffTaskWorkloadAssignee = {
  userId: string;
  name: string;
  email: string;
  staffUserType: string;
  open: number;
  overdue: number;
  inProgress: number;
  doneLast30Days: number;
  highPriorityOpen: number;
};

export type StaffTaskWorkloadAttention = {
  id: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  priority: string;
  status: string;
  daysOverdue: number;
};

export type StaffTaskWorkload = {
  summary: {
    open: number;
    overdue: number;
    doneLast30Days: number;
    dueThisWeek: number;
    highPriorityOpen: number;
    unassignedOpen: number;
  };
  byAssignee: StaffTaskWorkloadAssignee[];
  attention: StaffTaskWorkloadAttention[];
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysOverdue(dueAt: Date, today: Date): number {
  const due = startOfDay(dueAt).getTime();
  const now = startOfDay(today).getTime();
  if (now <= due) return 0;
  return Math.floor((now - due) / (1000 * 60 * 60 * 24));
}

export async function buildStaffTaskWorkload(
  organizationId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<StaffTaskWorkload> {
  const now = new Date();
  const today = startOfDay(now);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [memberships, tasks] = await Promise.all([
    db.organizationMembership.findMany({
      where: { organizationId, status: 'active' },
      include: {
        user: {
          select: { id: true, name: true, email: true, staffUserType: true, isActive: true },
        },
      },
      orderBy: { user: { name: 'asc' } },
    }),
    db.staffTask.findMany({
      where: {
        organizationId,
        OR: [
          { status: { in: ['todo', 'in_progress'] } },
          { status: 'done', completedAt: { gte: thirtyDaysAgo } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueAt: true,
        completedAt: true,
        assigneeId: true,
        assignee: { select: { name: true } },
      },
    }),
  ]);

  const byUser = new Map<string, StaffTaskWorkloadAssignee>();
  for (const membership of memberships) {
    const user = membership.user;
    if (!user?.isActive) continue;
    byUser.set(user.id, {
      userId: user.id,
      name: user.name,
      email: user.email,
      staffUserType: user.staffUserType,
      open: 0,
      overdue: 0,
      inProgress: 0,
      doneLast30Days: 0,
      highPriorityOpen: 0,
    });
  }

  let open = 0;
  let overdue = 0;
  let doneLast30Days = 0;
  let dueThisWeek = 0;
  let highPriorityOpen = 0;
  let unassignedOpen = 0;
  const attention: StaffTaskWorkloadAttention[] = [];

  for (const task of tasks) {
    const isActive = task.status === 'todo' || task.status === 'in_progress';
    const isHigh = task.priority === 'high' || task.priority === 'medium';

    if (task.status === 'done' && task.completedAt && task.completedAt >= thirtyDaysAgo) {
      doneLast30Days += 1;
      if (task.assigneeId) {
        const row = byUser.get(task.assigneeId);
        if (row) row.doneLast30Days += 1;
      }
      continue;
    }

    if (!isActive) continue;

    open += 1;
    if (!task.assigneeId) unassignedOpen += 1;
    if (isHigh) highPriorityOpen += 1;

    const isOverdue = task.dueAt != null && task.dueAt < today;
    if (isOverdue) overdue += 1;
    if (task.dueAt && task.dueAt >= today && task.dueAt < endOfWeek) dueThisWeek += 1;

    if (task.assigneeId) {
      const row = byUser.get(task.assigneeId);
      if (row) {
        row.open += 1;
        if (task.status === 'in_progress') row.inProgress += 1;
        if (isOverdue) row.overdue += 1;
        if (isHigh) row.highPriorityOpen += 1;
      }
    }

    if (isOverdue) {
      attention.push({
        id: task.id,
        title: task.title,
        assigneeId: task.assigneeId,
        assigneeName: task.assignee?.name ?? null,
        dueAt: task.dueAt?.toISOString() ?? null,
        priority: task.priority,
        status: task.status,
        daysOverdue: task.dueAt ? daysOverdue(task.dueAt, now) : 0,
      });
    }
  }

  attention.sort((a, b) => b.daysOverdue - a.daysOverdue || a.title.localeCompare(b.title));

  const byAssignee = [...byUser.values()]
    .filter((row) => row.open > 0 || row.doneLast30Days > 0)
    .sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name));

  return {
    summary: {
      open,
      overdue,
      doneLast30Days,
      dueThisWeek,
      highPriorityOpen,
      unassignedOpen,
    },
    byAssignee,
    attention: attention.slice(0, 20),
  };
}
