import { NextRequest, NextResponse } from 'next/server';

import { publishJobDescription, serializeJobDescriptionDetail } from '@/lib/performance/jd/service';
import { withTenant } from '@/lib/tenant-api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    const result = await ctx.run((tx) =>
      publishJobDescription(tx, {
        organizationId: ctx.organizationId,
        jobDescriptionId: id,
      }),
    );

    if (!result.ok) {
      const status = result.error === 'Job description not found' ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    await ctx.audit({
      action: 'performance.jd.published',
      entityType: 'JobDescription',
      entityId: id,
      route: 'POST /api/performance/jds/[id]/publish',
    });

    return NextResponse.json({ jobDescription: serializeJobDescriptionDetail(result.jobDescription) });
  });
}
