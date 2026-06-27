import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { buildProcurementSpendReport } from '@/lib/procurement/spend-analytics';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const yearParam = request.nextUrl.searchParams.get('year');
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year.' }, { status: 400 });
    }

    try {
      const report = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        return buildProcurementSpendReport(tx, {
          outsourcingClientId: clientId,
          year,
        });
      });
      return NextResponse.json({ report });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/procurement/spend',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load spend analytics.' }, { status: 500 });
    }
  });
}
