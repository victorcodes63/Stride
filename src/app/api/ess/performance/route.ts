import { NextRequest, NextResponse } from 'next/server';

import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) {
      return NextResponse.json({ cycle: null, review: null, goals: [] });
    }

    const cycle = await ctx.run((tx) =>
      tx.performanceCycle.findFirst({
        where: ctx.where({ status: 'active' }),
        orderBy: { activatedAt: 'desc' },
      }),
    );

    if (!cycle) {
      return NextResponse.json({ cycle: null, review: null, goals: [] });
    }

    const review = await ctx.run((tx) =>
      tx.performanceReview.findFirst({
        where: ctx.where({ cycleId: cycle.id, employeeId: ctx.employeeId! }),
        include: {
          ratings: { orderBy: { sortOrder: 'asc' } },
          feedback: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      }),
    );

    const goals = review
      ? await ctx.run((tx) =>
          tx.performanceGoal.findMany({
            where: ctx.where({ cycleId: cycle.id, employeeId: ctx.employeeId! }),
            orderBy: { sortOrder: 'asc' },
          }),
        )
      : [];

    return NextResponse.json({
      cycle: {
        id: cycle.id,
        name: cycle.name,
        periodStart: cycle.periodStart.toISOString().slice(0, 10),
        periodEnd: cycle.periodEnd.toISOString().slice(0, 10),
        status: cycle.status,
      },
      review,
      goals,
    });
  });
}

export async function PATCH(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) {
      return NextResponse.json({ error: 'No employee profile linked' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      reviewId?: string;
      selfSummary?: string;
      overallSelfRating?: number;
      ratings?: Array<{ dimension: string; selfScore: number }>;
      goals?: Array<{ id: string; selfScore: number }>;
      submit?: boolean;
    };

    if (!body.reviewId) {
      return NextResponse.json({ error: 'reviewId is required' }, { status: 400 });
    }

    const review = await ctx.run((tx) =>
      tx.performanceReview.findFirst({
        where: ctx.where({ id: body.reviewId, employeeId: ctx.employeeId! }),
      }),
    );
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const now = new Date();
    const submit = body.submit === true;

    if (body.ratings?.length) {
      await ctx.run(async (tx) => {
        for (const rating of body.ratings!) {
          await tx.performanceReviewRating.updateMany({
            where: ctx.where({ reviewId: review.id, dimension: rating.dimension }),
            data: { selfScore: rating.selfScore },
          });
        }
      });
    }

    if (body.goals?.length) {
      await ctx.run(async (tx) => {
        for (const goal of body.goals!) {
          await tx.performanceGoal.updateMany({
            where: ctx.where({ id: goal.id, employeeId: ctx.employeeId! }),
            data: { selfScore: goal.selfScore },
          });
        }
      });
    }

    const updated = await ctx.run((tx) =>
      tx.performanceReview.update({
        where: { id: review.id },
        data: {
          selfSummary: body.selfSummary?.trim() || undefined,
          overallSelfRating: body.overallSelfRating,
          status: submit ? 'self_submitted' : 'self_in_progress',
          selfSubmittedAt: submit ? now : undefined,
        },
        include: {
          ratings: { orderBy: { sortOrder: 'asc' } },
        },
      }),
    );

    if (body.selfSummary?.trim()) {
      await ctx.run((tx) =>
        tx.performanceFeedback.create({
          data: {
            organizationId: review.organizationId,
            reviewId: review.id,
            authorType: 'self',
            authorEssUserId: ctx.essUser.id,
            content: body.selfSummary!.trim(),
          },
        }),
      );
    }

    return NextResponse.json({ review: updated });
  });
}
