import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id: jobId } = await params;
    const profile = await ctx.run((tx) => tx.jobCompetencyProfile.findFirst({ where: ctx.where({ jobId }) }));
    return NextResponse.json(profile ?? { jobId, weights: {}, targets: null });
  });
}

/** Upsert the weighting of competency dimensions used to compute candidate fit. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id: jobId } = await params;
    const job = await ctx.run((tx) => tx.job.findFirst({ where: ctx.where({ id: jobId }), select: { id: true } }));
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

    const body = (await request.json()) as { weights?: Record<string, number>; targets?: unknown };
    const weights = body.weights && typeof body.weights === 'object' ? body.weights : {};

    const profile = await ctx.run((tx) =>
      tx.jobCompetencyProfile.upsert({
        where: { jobId },
        create: {
          organizationId: ctx.organizationId,
          jobId,
          weights: weights as Prisma.InputJsonValue,
          targets: (body.targets ?? undefined) as Prisma.InputJsonValue | undefined,
        },
        update: {
          weights: weights as Prisma.InputJsonValue,
          targets: (body.targets ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      }),
    );
    await ctx.audit({ action: 'ats.competency_profile.updated', entityType: 'Job', entityId: jobId });
    return NextResponse.json(profile);
  });
}
