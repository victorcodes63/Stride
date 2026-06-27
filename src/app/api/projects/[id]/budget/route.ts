import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { buildProjectBudgetReport } from '@/lib/projects/project-budget';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    try {
      const report = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        return buildProjectBudgetReport(tx, {
          projectId: id,
          outsourcingClientId: clientId,
        });
      });
      if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ report });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/[id]/budget',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load project budget.' }, { status: 500 });
    }
  });
}
