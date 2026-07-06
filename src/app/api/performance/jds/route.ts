import { NextRequest, NextResponse } from 'next/server';

import type { JobDescriptionInput } from '@/lib/performance/jd/types';
import {
  createJobDescriptionManual,
  serializeJobDescription,
  serializeJobDescriptionDetail,
} from '@/lib/performance/jd/service';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const status = request.nextUrl.searchParams.get('status') || undefined;
    const divisionId = request.nextUrl.searchParams.get('divisionId') || undefined;
    const q = request.nextUrl.searchParams.get('q')?.trim();

    const rows = await ctx.run((tx) =>
      tx.jobDescription.findMany({
        where: {
          ...ctx.where(),
          ...(status ? { status: status as never } : {}),
          ...(divisionId ? { divisionId } : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: 'insensitive' } },
                  { grade: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: {
          division: { select: { name: true } },
          _count: { select: { kras: true, competencies: true } },
        },
        orderBy: [{ title: 'asc' }, { version: 'desc' }],
      }),
    );

    await ctx.audit({
      action: 'performance.jd.list',
      entityType: 'JobDescription',
      route: 'GET /api/performance/jds',
    });

    return NextResponse.json({ jobDescriptions: rows.map(serializeJobDescription) });
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const body = (await request.json().catch(() => ({}))) as JobDescriptionInput;
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const result = await ctx.run((tx) =>
      createJobDescriptionManual(tx, {
        organizationId: ctx.organizationId,
        createdByUserId: ctx.staff.id,
        data: body,
      }),
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await ctx.audit({
      action: 'performance.jd.created',
      entityType: 'JobDescription',
      entityId: result.jobDescription.id,
      route: 'POST /api/performance/jds',
    });

    return NextResponse.json(
      { jobDescription: serializeJobDescriptionDetail(result.jobDescription) },
      { status: 201 },
    );
  });
}
