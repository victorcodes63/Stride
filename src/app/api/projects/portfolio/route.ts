import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { buildProjectBudgetReport } from '@/lib/projects/project-budget';
import { withTenant } from '@/lib/tenant-api';

const PROJECT_LIMIT = 200;
// Budget analysis is comparatively expensive (several queries per project),
// so cap how many projects we run the full report for.
const BUDGET_ANALYSIS_LIMIT = 25;
const UPCOMING_MILESTONE_LIMIT = 15;

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const payload = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const now = new Date();
        const projectScope = { organizationId: ctx.organizationId, outsourcingClientId: clientId };
        const taskScope = {
          organizationId: ctx.organizationId,
          project: { outsourcingClientId: clientId },
        };

        const [
          statusGroups,
          healthGroups,
          projects,
          overdueGroups,
          workloadGroups,
          upcomingMilestones,
          totalTasks,
          doneTasks,
        ] = await Promise.all([
          tx.project.groupBy({ by: ['status'], where: projectScope, _count: { _all: true } }),
          tx.project.groupBy({ by: ['health'], where: projectScope, _count: { _all: true } }),
          tx.project.findMany({
            where: projectScope,
            select: {
              id: true,
              projectCode: true,
              name: true,
              status: true,
              health: true,
              dueDate: true,
              budgetAmount: true,
              budgetId: true,
              ownerUserId: true,
              owner: { select: { id: true, name: true } },
            },
            orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
            take: PROJECT_LIMIT,
          }),
          tx.projectTask.groupBy({
            by: ['projectId'],
            where: { ...taskScope, status: { not: 'done' }, dueDate: { lt: now } },
            _count: { _all: true },
          }),
          tx.projectTask.groupBy({
            by: ['assigneeUserId'],
            where: { ...taskScope, status: { not: 'done' }, assigneeUserId: { not: null } },
            _count: { _all: true },
            _sum: { estimateHours: true },
          }),
          tx.projectMilestone.findMany({
            where: {
              organizationId: ctx.organizationId,
              project: { outsourcingClientId: clientId },
              status: { not: 'done' },
              dueDate: { gte: now },
            },
            select: {
              id: true,
              title: true,
              dueDate: true,
              progress: true,
              project: { select: { id: true, projectCode: true, name: true } },
            },
            orderBy: { dueDate: 'asc' },
            take: UPCOMING_MILESTONE_LIMIT,
          }),
          tx.projectTask.count({ where: taskScope }),
          tx.projectTask.count({ where: { ...taskScope, status: 'done' } }),
        ]);

        const overdueByProject = new Map(overdueGroups.map((g) => [g.projectId, g._count._all]));

        // Resolve workload assignee names.
        const assigneeIds = workloadGroups
          .map((g) => g.assigneeUserId)
          .filter((idValue): idValue is string => Boolean(idValue));
        const assignees = assigneeIds.length
          ? await tx.user.findMany({
              where: { id: { in: assigneeIds } },
              select: { id: true, name: true, email: true },
            })
          : [];
        const assigneeMap = new Map(assignees.map((u) => [u.id, u]));
        const workload = workloadGroups.map((g) => ({
          userId: g.assigneeUserId as string,
          name: assigneeMap.get(g.assigneeUserId as string)?.name ?? null,
          openTaskCount: g._count._all,
          estimateHours: g._sum.estimateHours != null ? Number(g._sum.estimateHours) : 0,
        }));

        // Budget analysis for a bounded set of budgeted projects (prioritize
        // those already showing risk signals).
        const budgeted = projects.filter((p) => p.budgetId || p.budgetAmount != null);
        const prioritized = [
          ...budgeted.filter(
            (p) => p.health !== 'on_track' || (overdueByProject.get(p.id) ?? 0) > 0,
          ),
          ...budgeted.filter(
            (p) => p.health === 'on_track' && (overdueByProject.get(p.id) ?? 0) === 0,
          ),
        ].slice(0, BUDGET_ANALYSIS_LIMIT);

        const budgetUtilByProject = new Map<string, number>();
        for (const project of prioritized) {
          const report = await buildProjectBudgetReport(tx as never, {
            projectId: project.id,
            outsourcingClientId: clientId,
          });
          if (report) budgetUtilByProject.set(project.id, report.utilizationPercent);
        }

        // Assemble at-risk list.
        const atRisk = projects
          .map((p) => {
            const overdueTaskCount = overdueByProject.get(p.id) ?? 0;
            const budgetUtilizationPercent = budgetUtilByProject.get(p.id);
            const reasons: string[] = [];
            if (p.health !== 'on_track') reasons.push(`health:${p.health}`);
            if (overdueTaskCount > 0) reasons.push('overdue_tasks');
            if (budgetUtilizationPercent != null && budgetUtilizationPercent > 100) {
              reasons.push('over_budget');
            }
            return {
              id: p.id,
              projectCode: p.projectCode,
              name: p.name,
              status: p.status,
              health: p.health,
              dueDate: p.dueDate ? p.dueDate.toISOString().slice(0, 10) : null,
              owner: p.owner ? { id: p.owner.id, name: p.owner.name } : null,
              overdueTaskCount,
              budgetUtilizationPercent: budgetUtilizationPercent ?? null,
              reasons,
            };
          })
          .filter((p) => p.reasons.length > 0)
          .sort((a, b) => b.reasons.length - a.reasons.length || b.overdueTaskCount - a.overdueTaskCount);

        const statusCounts: Record<string, number> = {};
        for (const g of statusGroups) statusCounts[g.status] = g._count._all;
        const healthCounts: Record<string, number> = { on_track: 0, at_risk: 0, off_track: 0 };
        for (const g of healthGroups) healthCounts[g.health] = g._count._all;

        const totalProjects = projects.length;
        const completionPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

        return {
          summary: {
            totalProjects,
            totalTasks,
            doneTasks,
            completionPercent,
          },
          statusCounts,
          healthCounts,
          atRisk,
          workload: workload.sort((a, b) => b.openTaskCount - a.openTaskCount),
          upcomingMilestones: upcomingMilestones.map((m) => ({
            id: m.id,
            title: m.title,
            dueDate: m.dueDate ? m.dueDate.toISOString().slice(0, 10) : null,
            progress: m.progress,
            project: m.project
              ? { id: m.project.id, projectCode: m.project.projectCode, name: m.project.name }
              : null,
          })),
        };
      });

      return NextResponse.json(payload);
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/portfolio',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load portfolio.' }, { status: 500 });
    }
  });
}
