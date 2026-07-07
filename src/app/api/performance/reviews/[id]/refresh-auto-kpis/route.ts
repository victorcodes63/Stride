import { NextRequest, NextResponse } from 'next/server';

import { refreshAutoKpisForReview } from '@/lib/performance/kpi/auto-kpi';
import { withTenant } from '@/lib/tenant-api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    const review = await ctx.run((tx) =>
      tx.performanceReview.findFirst({
        where: ctx.where({ id }),
        include: { cycle: true },
      }),
    );
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const result = await ctx.run((tx) =>
      refreshAutoKpisForReview(tx, {
        organizationId: ctx.organizationId,
        reviewId: review.id,
        periodStart: review.cycle.periodStart,
        periodEnd: review.cycle.periodEnd,
      }),
    );

    await ctx.audit({
      action: 'performance.review.auto_kpi_refreshed',
      entityType: 'PerformanceReview',
      entityId: id,
      route: 'POST /api/performance/reviews/[id]/refresh-auto-kpis',
      metadata: result,
    });

    return NextResponse.json(result);
  });
}
