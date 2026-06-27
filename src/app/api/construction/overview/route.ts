import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessConstruction, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessConstruction(ctx.staff)) {
      return forbiddenResponse('Construction access is restricted to operations and admin users.');
    }

    try {
      const summary = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );

        const [activeSites, plantOnSite, activeSubcontractors, subcontractorExposure] =
          await Promise.all([
            tx.constructionSite.count({
              where: { ...ctx.where(), outsourcingClientId: clientId, status: 'active' },
            }),
            tx.constructionPlantAsset.count({
              where: { ...ctx.where(), outsourcingClientId: clientId, status: 'on_site' },
            }),
            tx.constructionSubcontractor.count({
              where: { ...ctx.where(), outsourcingClientId: clientId, status: 'active' },
            }),
            tx.constructionSubcontractor.aggregate({
              where: { ...ctx.where(), outsourcingClientId: clientId, status: 'active' },
              _sum: { amountInvoiced: true, amountPaid: true },
            }),
          ]);

        const invoiced = Number(subcontractorExposure._sum.amountInvoiced ?? 0);
        const paid = Number(subcontractorExposure._sum.amountPaid ?? 0);

        return {
          activeSites,
          plantOnSite,
          activeSubcontractors,
          subcontractorInvoiced: invoiced,
          subcontractorPaid: paid,
          subcontractorOutstanding: Math.max(0, invoiced - paid),
        };
      });

      return NextResponse.json({ summary });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/construction/overview',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load construction overview.' }, { status: 500 });
    }
  });
}
