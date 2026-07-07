import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { buildAttainmentReport } from '@/lib/sales/attainment-analytics';
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
      const report = await ctx.run((tx) =>
        buildAttainmentReport(tx, {
          organizationId: ctx.organizationId,
          periodStart,
          periodEnd,
        }),
      );

      return NextResponse.json({ report });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/attainment',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load attainment report.' }, { status: 500 });
    }
  });
}
