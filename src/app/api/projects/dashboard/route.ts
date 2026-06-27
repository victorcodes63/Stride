import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { buildProjectBudgetReport } from '@/lib/projects/project-budget';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const payload = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const now = new Date();
        const soon = new Date(now);
        soon.setDate(soon.getDate() + 14);

        const [projects, openTasks, overdueTasks, milestoneCounts, tasksDueSoon] = await Promise.all([
          tx.project.findMany({
            where: ctx.where({ outsourcingClientId: clientId }),
            select: {
              id: true,
              projectCode: true,
              name: true,
              status: true,
              department: true,
              dueDate: true,
              _count: { select: { milestones: true, tasks: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 50,
          }),
          tx.projectTask.count({
            where: {
              ...ctx.where(),
              project: { outsourcingClientId: clientId },
              status: { not: 'done' },
            },
          }),
          tx.projectTask.count({
            where: {
              ...ctx.where(),
              project: { outsourcingClientId: clientId },
              status: { not: 'done' },
              dueDate: { lt: now },
            },
          }),
          tx.projectMilestone.groupBy({
            by: ['status'],
            where: { ...ctx.where(), project: { outsourcingClientId: clientId } },
            _count: { _all: true },
          }),
          tx.projectTask.findMany({
            where: {
              ...ctx.where(),
              project: { outsourcingClientId: clientId },
              status: { not: 'done' },
              dueDate: { lte: soon },
            },
            select: {
              id: true,
              title: true,
              dueDate: true,
              status: true,
              project: { select: { id: true, projectCode: true, name: true } },
            },
            orderBy: { dueDate: 'asc' },
            take: 8,
          }),
        ]);

        const activeCount = projects.filter((p) => p.status === 'active').length;
        const milestonesTotal = milestoneCounts.reduce((n, g) => n + g._count._all, 0);
        const milestonesDone =
          milestoneCounts.find((g) => g.status === 'done')?._count._all ?? 0;

        const statusBreakdown = {
          planning: projects.filter((p) => p.status === 'planning').length,
          active: activeCount,
          on_hold: projects.filter((p) => p.status === 'on_hold').length,
          completed: projects.filter((p) => p.status === 'completed').length,
        };

        const activeProjects = projects.filter((p) => p.status === 'active').slice(0, 12);
        const burnReports = [];
        for (const p of activeProjects) {
          const report = await buildProjectBudgetReport(tx, {
            projectId: p.id,
            outsourcingClientId: clientId,
          });
          if (report) burnReports.push(report);
        }
        burnReports.sort((a, b) => b.utilizationPercent - a.utilizationPercent);

        const milestoneByProject = await tx.projectMilestone.groupBy({
          by: ['projectId', 'status'],
          where: { projectId: { in: projects.map((p) => p.id) }, ...ctx.where() },
          _count: { _all: true },
        });
        const milestoneMap = new Map<string, { done: number; total: number }>();
        for (const row of milestoneByProject) {
          const cur = milestoneMap.get(row.projectId) ?? { done: 0, total: 0 };
          cur.total += row._count._all;
          if (row.status === 'done') cur.done += row._count._all;
          milestoneMap.set(row.projectId, cur);
        }

        const deliverables = projects
          .filter((p) => p._count.milestones > 0 || p._count.tasks > 0)
          .slice(0, 10)
          .map((p) => {
            const ms = milestoneMap.get(p.id) ?? { done: 0, total: p._count.milestones };
            return {
              projectId: p.id,
              projectCode: p.projectCode,
              name: p.name,
              status: p.status,
              dueDate: p.dueDate?.toISOString().slice(0, 10) ?? null,
              milestones: ms,
              openTasks: p._count.tasks,
            };
          });

        return {
          summary: {
            total: projects.length,
            active: activeCount,
            openTasks,
            overdueTasks,
            milestonesDone,
            milestonesTotal,
          },
          statusBreakdown,
          burnTop: burnReports.slice(0, 5),
          deliverables,
          tasksDueSoon: tasksDueSoon.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null,
            project: t.project,
          })),
        };
      });

      return NextResponse.json(payload);
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/dashboard',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load projects dashboard.' }, { status: 500 });
    }
  });
}
