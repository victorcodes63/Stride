import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { computeTemplateAnalytics } from '@/lib/assessments/analytics';
import { usageSummary } from '@/lib/assessments/usage';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const url = new URL(request.url);
    const templateId = url.searchParams.get('templateId');

    if (templateId) {
      const analytics = await computeTemplateAnalytics(ctx.organizationId, templateId);
      if (!analytics) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
      return NextResponse.json(analytics);
    }

    // Overview: usage + per-template summary rows.
    const templates = await ctx.run((tx) =>
      tx.assessmentTemplate.findMany({
        where: { organizationId: ctx.organizationId, isActive: true },
        select: {
          id: true,
          name: true,
          _count: { select: { applicationAttempts: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    );

    const usage = await usageSummary(ctx.organizationId, 30);

    // Aggregate submitted attempts + avg score per template in one pass.
    const rows = await ctx.run((tx) =>
      tx.applicationAssessmentAttempt.groupBy({
        by: ['templateId'],
        where: { organizationId: ctx.organizationId, status: { in: ['submitted', 'awaiting_review'] } },
        _count: { _all: true },
        _avg: { scorePercent: true },
      }),
    );
    const byTemplate = new Map(rows.map((r) => [r.templateId, r]));

    return NextResponse.json({
      usage,
      templates: templates.map((t) => {
        const agg = byTemplate.get(t.id);
        return {
          id: t.id,
          name: t.name,
          totalAttempts: t._count.applicationAttempts,
          completed: agg?._count._all ?? 0,
          avgScorePercent: agg?._avg.scorePercent != null ? Number(agg._avg.scorePercent) : null,
        };
      }),
    });
  });
}
