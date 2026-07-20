import { NextRequest, NextResponse } from 'next/server';

import { buildAiEvaluationSuggestions } from '@/lib/performance/ai/evaluation-assist';
import { withTenant } from '@/lib/tenant-api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    if (process.env.STRIDE_AI_EVAL_DRY_RUN !== '1' && process.env.STRIDE_AI_EVAL_ENABLE_LLM !== '1') {
      return NextResponse.json(
        { error: 'AI evaluation assist requires STRIDE_AI_EVAL_DRY_RUN=1 or STRIDE_AI_EVAL_ENABLE_LLM=1 in this cell.' },
        { status: 503 },
      );
    }

    const review = await ctx.run((tx) =>
      tx.performanceReview.findFirst({
        where: ctx.where({ id }),
        include: { ratings: true },
      }),
    );
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Goals are keyed by cycle + employee (no direct relation on PerformanceReview).
    const goals = await ctx.run((tx) =>
      tx.performanceGoal.findMany({
        where: { organizationId: ctx.organizationId, cycleId: review.cycleId, employeeId: review.employeeId },
      }),
    );

    const parserConfig = await ctx.run((tx) =>
      tx.jdParserConfig.findUnique({ where: { organizationId: ctx.organizationId } }),
    );

    try {
      const suggestions = await buildAiEvaluationSuggestions({
        organizationId: ctx.organizationId,
        review,
        goals,
        parserConfig: parserConfig
          ? {
              mode: parserConfig.mode,
              aiEvaluationEnabled: parserConfig.aiEvaluationEnabled,
              aiEvaluationConsentAt: parserConfig.aiEvaluationConsentAt,
              consentAt: parserConfig.consentAt,
            }
          : null,
      });

      await ctx.run((tx) =>
        tx.performanceReview.update({
          where: { id: review.id },
          data: { aiSuggestions: suggestions },
        }),
      );

      await ctx.audit({
        action: 'performance.review.ai_suggestions',
        entityType: 'PerformanceReview',
        entityId: id,
        route: 'POST /api/performance/reviews/[id]/ai-suggestions',
      });

      return NextResponse.json({ suggestions });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI evaluation assist unavailable';
      return NextResponse.json({ error: message }, { status: 403 });
    }
  });
}
