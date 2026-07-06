import { NextRequest, NextResponse } from 'next/server';

import type { JobDescriptionInput } from '@/lib/performance/jd/types';
import {
  serializeJobDescriptionDetail,
  updateJobDescriptionDraft,
} from '@/lib/performance/jd/service';
import { withTenant } from '@/lib/tenant-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const row = await ctx.run((tx) =>
      tx.jobDescription.findFirst({
        where: ctx.where({ id }),
        include: {
          division: { select: { name: true } },
          kras: {
            orderBy: { sortOrder: 'asc' },
            include: { kpis: { orderBy: { sortOrder: 'asc' } } },
          },
          competencies: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { kras: true, competencies: true } },
        },
      }),
    );

    if (!row) return NextResponse.json({ error: 'Job description not found' }, { status: 404 });

    return NextResponse.json({ jobDescription: serializeJobDescriptionDetail(row) });
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as JobDescriptionInput;
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const result = await ctx.run((tx) =>
      updateJobDescriptionDraft(tx, {
        organizationId: ctx.organizationId,
        jobDescriptionId: id,
        data: body,
      }),
    );

    if (!result.ok) {
      const status = result.error === 'Job description not found' ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    await ctx.audit({
      action: 'performance.jd.updated',
      entityType: 'JobDescription',
      entityId: id,
      route: 'PATCH /api/performance/jds/[id]',
    });

    return NextResponse.json({ jobDescription: serializeJobDescriptionDetail(result.jobDescription) });
  });
}
