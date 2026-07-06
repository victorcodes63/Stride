import { NextRequest, NextResponse } from 'next/server';

import { generateScorecardFromJobDescription, serializeScorecardTemplate } from '@/lib/performance/scorecard/service';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const templates = await ctx.run((tx) =>
      tx.scorecardTemplate.findMany({
        where: ctx.where(),
        include: {
          perspectives: true,
          measures: true,
          competencyReqs: true,
          jobDescription: { select: { id: true, version: true, title: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    );

    return NextResponse.json({ templates: templates.map(serializeScorecardTemplate) });
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const body = (await request.json().catch(() => ({}))) as {
      jobDescriptionId?: string;
      resultsWeightPercent?: number;
      competenciesWeightPercent?: number;
    };

    if (!body.jobDescriptionId) {
      return NextResponse.json({ error: 'jobDescriptionId is required' }, { status: 400 });
    }

    const result = await ctx.run((tx) =>
      generateScorecardFromJobDescription(tx, {
        organizationId: ctx.organizationId,
        jobDescriptionId: body.jobDescriptionId!,
        resultsWeightPercent: body.resultsWeightPercent,
        competenciesWeightPercent: body.competenciesWeightPercent,
      }),
    );

    if (!result.ok) {
      const status = result.error.includes('not found') ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    await ctx.audit({
      action: 'performance.scorecard.generated',
      entityType: 'ScorecardTemplate',
      entityId: result.template.id,
      route: 'POST /api/performance/scorecards',
    });

    return NextResponse.json(
      { template: serializeScorecardTemplate(result.template) },
      { status: 201 },
    );
  });
}
