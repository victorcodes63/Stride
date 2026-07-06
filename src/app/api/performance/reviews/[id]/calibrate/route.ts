import { NextRequest, NextResponse } from 'next/server';

import { completeReviewCalibration } from '@/lib/performance/service';
import { withTenant } from '@/lib/tenant-api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    const result = await ctx.run((tx) =>
      completeReviewCalibration(tx, {
        organizationId: ctx.organizationId,
        reviewId: id,
      }),
    );

    if (!result.ok) {
      const status = result.error === 'Review not found' ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    await ctx.audit({
      action: 'performance.review.calibrated',
      entityType: 'PerformanceReview',
      entityId: id,
      route: 'POST /api/performance/reviews/[id]/calibrate',
    });

    return NextResponse.json({ scores: result.scores });
  });
}
