import { NextRequest, NextResponse } from 'next/server';
import type { OnboardingTaskStatus, WorkflowType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';
import { forbiddenResponse } from '@/lib/demo-route-access';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TASK_STATUSES: OnboardingTaskStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED',
  'OVERDUE',
];

type TaskRecord = {
  status: OnboardingTaskStatus;
  category: string | null;
  isRequired: boolean;
  startDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  assignedRole: string;
  assignedTo: { name: string } | null;
};

type WorkflowRecord = {
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startedAt: Date;
  completedAt: Date | null;
  employee: { department: { name: string | null } | null } | null;
  tasks: TaskRecord[];
};

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isTaskOpen(status: OnboardingTaskStatus): boolean {
  return status === 'PENDING' || status === 'IN_PROGRESS' || status === 'OVERDUE';
}

function isTaskOverdue(task: TaskRecord, now: Date): boolean {
  if (task.status === 'OVERDUE') return true;
  if (
    (task.status === 'PENDING' || task.status === 'IN_PROGRESS') &&
    task.dueDate &&
    task.dueDate < now
  ) {
    return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('You do not have access to onboarding analytics.');
    }

    const url = new URL(request.url);
    const rawType = url.searchParams.get('type');
    const type: WorkflowType = rawType === 'OFFBOARDING' ? 'OFFBOARDING' : 'ONBOARDING';

    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );

    const workflows = (await ctx.run((tx) =>
      tx.onboardingWorkflow.findMany({
        where: {
          ...ctx.where(),
          type,
          employee: { outsourcingClientId: workspaceClientId },
        },
        select: {
          status: true,
          startedAt: true,
          completedAt: true,
          employee: { select: { department: { select: { name: true } } } },
          tasks: {
            select: {
              status: true,
              category: true,
              isRequired: true,
              startDate: true,
              dueDate: true,
              completedAt: true,
              assignedRole: true,
              assignedTo: { select: { name: true } },
            },
          },
        },
      }),
    )) as WorkflowRecord[];

    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * MS_PER_DAY);

    let activeWorkflows = 0;
    let completedAllTime = 0;
    let completedLast90d = 0;
    let cancelledWorkflows = 0;

    const completionDurations: number[] = [];

    const statusCounts: Record<OnboardingTaskStatus, number> = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      SKIPPED: 0,
      OVERDUE: 0,
    };

    let completedWithDue = 0;
    let completedOnTime = 0;
    let totalOverdueTasks = 0;

    const categoryMap = new Map<
      string,
      { total: number; completed: number; overdue: number; openDays: number[] }
    >();
    const ownerMap = new Map<string, number>();
    const deptMap = new Map<string, { count: number; progressSum: number }>();

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('en-US', { month: 'short' }),
        year: d.getFullYear(),
        month: d.getMonth(),
        started: 0,
        completed: 0,
      };
    });
    const monthIndex = new Map(months.map((m, i) => [`${m.year}-${m.month}`, i] as const));

    for (const wf of workflows) {
      if (wf.status === 'IN_PROGRESS') activeWorkflows += 1;
      else if (wf.status === 'CANCELLED') cancelledWorkflows += 1;
      else if (wf.status === 'COMPLETED') {
        completedAllTime += 1;
        if (wf.completedAt && wf.completedAt >= ninetyDaysAgo) completedLast90d += 1;
        if (wf.completedAt) {
          const days = (wf.completedAt.getTime() - wf.startedAt.getTime()) / MS_PER_DAY;
          if (Number.isFinite(days) && days >= 0) completionDurations.push(days);
        }
      }

      const startedIdx = monthIndex.get(`${wf.startedAt.getFullYear()}-${wf.startedAt.getMonth()}`);
      if (startedIdx != null) months[startedIdx].started += 1;
      if (wf.completedAt) {
        const completedIdx = monthIndex.get(
          `${wf.completedAt.getFullYear()}-${wf.completedAt.getMonth()}`,
        );
        if (completedIdx != null) months[completedIdx].completed += 1;
      }

      let wfCompletedTasks = 0;
      for (const task of wf.tasks) {
        statusCounts[task.status] += 1;

        if (task.status === 'COMPLETED') {
          wfCompletedTasks += 1;
          if (task.dueDate && task.completedAt) {
            completedWithDue += 1;
            if (task.completedAt <= task.dueDate) completedOnTime += 1;
          }
        }

        const overdue = isTaskOverdue(task, now);
        if (overdue) totalOverdueTasks += 1;

        const categoryKey = task.category?.trim() || 'Uncategorized';
        const cat = categoryMap.get(categoryKey) ?? {
          total: 0,
          completed: 0,
          overdue: 0,
          openDays: [],
        };
        cat.total += 1;
        if (task.status === 'COMPLETED') cat.completed += 1;
        if (overdue) cat.overdue += 1;
        if (isTaskOpen(task.status) && task.startDate) {
          const openDays = (now.getTime() - task.startDate.getTime()) / MS_PER_DAY;
          if (Number.isFinite(openDays) && openDays >= 0) cat.openDays.push(openDays);
        }
        categoryMap.set(categoryKey, cat);

        if (overdue) {
          const ownerKey = task.assignedTo?.name?.trim() || task.assignedRole || 'Unassigned';
          ownerMap.set(ownerKey, (ownerMap.get(ownerKey) ?? 0) + 1);
        }
      }

      const deptName = wf.employee?.department?.name?.trim() || 'Unassigned';
      const totalTasks = wf.tasks.length;
      const progress = totalTasks > 0 ? (wfCompletedTasks / totalTasks) * 100 : 0;
      const dept = deptMap.get(deptName) ?? { count: 0, progressSum: 0 };
      dept.count += 1;
      dept.progressSum += progress;
      deptMap.set(deptName, dept);
    }

    const avgCompletionDays =
      completionDurations.length > 0
        ? round(
            completionDurations.reduce((sum, d) => sum + d, 0) / completionDurations.length,
          )
        : 0;

    const onTimeRate = completedWithDue > 0 ? round((completedOnTime / completedWithDue) * 100, 0) : 0;

    const bottlenecks = Array.from(categoryMap.entries())
      .map(([category, v]) => ({
        category,
        total: v.total,
        completed: v.completed,
        overdue: v.overdue,
        avgOpenDays:
          v.openDays.length > 0
            ? round(v.openDays.reduce((sum, d) => sum + d, 0) / v.openDays.length)
            : 0,
      }))
      .sort((a, b) => b.overdue - a.overdue || b.avgOpenDays - a.avgOpenDays);

    const overdueByOwner = Array.from(ownerMap.entries())
      .map(([owner, count]) => ({ owner, count }))
      .sort((a, b) => b.count - a.count);

    const byDepartment = Array.from(deptMap.entries())
      .map(([department, v]) => ({
        department,
        workflows: v.count,
        avgProgress: v.count > 0 ? round(v.progressSum / v.count, 0) : 0,
      }))
      .sort((a, b) => b.workflows - a.workflows);

    const statusBreakdown = TASK_STATUSES.map((status) => ({
      status,
      count: statusCounts[status],
    }));

    const throughput = months.map((m) => ({
      label: m.label,
      key: m.key,
      started: m.started,
      completed: m.completed,
    }));

    return NextResponse.json({
      type,
      summary: {
        activeWorkflows,
        completedWorkflows: { last90d: completedLast90d, allTime: completedAllTime },
        cancelledWorkflows,
        avgCompletionDays,
        onTimeRate,
        totalOverdueTasks,
      },
      statusBreakdown,
      bottlenecks,
      overdueByOwner,
      byDepartment,
      throughput,
    });
  });
}
