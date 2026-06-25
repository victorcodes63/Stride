import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { buildProjectBudgetReport } from '@/lib/projects/project-budget';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const reports = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        const status = request.nextUrl.searchParams.get('status')?.trim() || 'active';

        const projects = await tx.project.findMany({
          where: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            ...(status && status !== 'all' ? { status: status as never } : {}),
          },
          select: { id: true },
          orderBy: { updatedAt: 'desc' },
          take: 50,
        });

        const rows = [];
        for (const p of projects) {
          const report = await buildProjectBudgetReport(tx, {
            projectId: p.id,
            outsourcingClientId: clientId,
          });
          if (report) rows.push(report);
        }

        rows.sort((a, b) => b.utilizationPercent - a.utilizationPercent);
        return rows;
      });

      return NextResponse.json({ reports });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/budget-summary',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load budget summary.' }, { status: 500 });
    }
  });
}
