import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { withTenant } from '@/lib/tenant-api';
import { buildVelocitySeries } from '@/lib/projects/velocity';

/** Completion velocity + status mix for portfolio charts. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const payload = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        const taskScope = {
          organizationId: ctx.organizationId,
          project: { outsourcingClientId: clientId },
        };

        const weeks = 8;
        const since = new Date();
        since.setDate(since.getDate() - weeks * 7);
        since.setHours(0, 0, 0, 0);

        const [completed, created, statusGroups, openOverdue, openTotal] = await Promise.all([
          tx.projectTask.findMany({
            where: { ...taskScope, completedAt: { gte: since } },
            select: { completedAt: true },
          }),
          tx.projectTask.findMany({
            where: { ...taskScope, createdAt: { gte: since }, parentTaskId: null },
            select: { createdAt: true },
          }),
          tx.projectTask.groupBy({
            by: ['status'],
            where: { ...taskScope, parentTaskId: null },
            _count: { _all: true },
          }),
          tx.projectTask.count({
            where: {
              ...taskScope,
              parentTaskId: null,
              status: { not: 'done' },
              dueDate: { lt: new Date() },
            },
          }),
          tx.projectTask.count({
            where: { ...taskScope, parentTaskId: null, status: { not: 'done' } },
          }),
        ]);

        const velocity = buildVelocitySeries({
          weeks,
          completedAt: completed.map((t) => t.completedAt).filter((d): d is Date => d != null),
          createdAt: created.map((t) => t.createdAt),
        });

        const statusMix: Record<string, number> = {};
        for (const g of statusGroups) statusMix[g.status] = g._count._all;

        return {
          velocity,
          statusMix,
          openOverdue,
          openTotal,
        };
      });

      return NextResponse.json(payload);
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/analytics',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load analytics.' }, { status: 500 });
    }
  });
}
