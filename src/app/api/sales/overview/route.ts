import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import {
  avgSalesCycleDays,
  avgWonDealValue,
  computeSalesVelocity,
  computeWinRate,
  type AnalyticsDeal,
} from '@/lib/sales/analytics';
import { buildSalesOverview } from '@/lib/sales/overview-analytics';
import { parsePeriodBounds } from '@/lib/sales/schema';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const periodType = request.nextUrl.searchParams.get('periodType')?.trim() || 'month';
    const anchorStr = request.nextUrl.searchParams.get('periodStart')?.trim();
    const anchor = anchorStr ? new Date(`${anchorStr}T00:00:00.000Z`) : new Date();
    const { periodStart, periodEnd } = parsePeriodBounds(
      periodType === 'quarter' || periodType === 'year' ? periodType : 'month',
      anchor,
    );

    try {
      const { overview, performance } = await ctx.run(async (tx) => {
        const overview = await buildSalesOverview(tx, {
          organizationId: ctx.organizationId,
          periodStart,
          periodEnd,
        });

        const dealRows = await tx.salesDeal.findMany({
          where: { organizationId: ctx.organizationId },
          select: {
            stage: true,
            value: true,
            probability: true,
            createdAt: true,
            closedAt: true,
            stageEnteredAt: true,
            lastActivityAt: true,
          },
        });

        const deals: AnalyticsDeal[] = dealRows.map((d) => ({
          stage: d.stage,
          value: Number(d.value),
          probability: d.probability,
          createdAt: d.createdAt,
          closedAt: d.closedAt,
          stageEnteredAt: d.stageEnteredAt,
          lastActivityAt: d.lastActivityAt,
        }));

        return {
          overview,
          performance: {
            winRatePct: computeWinRate(deals),
            avgDealSize: avgWonDealValue(deals),
            avgSalesCycleDays: avgSalesCycleDays(deals),
            salesVelocity: computeSalesVelocity(deals),
          },
        };
      });

      return NextResponse.json({ overview: { ...overview, ...performance } });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/overview',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load sales overview.' }, { status: 500 });
    }
  });
}
