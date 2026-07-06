import { NextRequest, NextResponse } from 'next/server';

import { serializeScorecardTemplate } from '@/lib/performance/scorecard/service';
import { withTenant } from '@/lib/tenant-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const template = await ctx.run((tx) =>
      tx.scorecardTemplate.findFirst({
        where: ctx.where({ id }),
        include: {
          perspectives: { orderBy: { sortOrder: 'asc' } },
          measures: { orderBy: { sortOrder: 'asc' } },
          competencyReqs: { orderBy: { sortOrder: 'asc' } },
          jobDescription: { select: { id: true, version: true, title: true } },
        },
      }),
    );

    if (!template) return NextResponse.json({ error: 'Scorecard not found' }, { status: 404 });

    return NextResponse.json({
      template: {
        ...serializeScorecardTemplate(template),
        perspectives: template.perspectives,
        measures: template.measures,
        competencies: template.competencyReqs,
      },
    });
  });
}
