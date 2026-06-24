import { NextRequest, NextResponse } from 'next/server';

import { requireEssUser } from '@/lib/ess-api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.employeeId) {
    return NextResponse.json({ cycle: null, review: null, goals: [] });
  }

  const cycle = await prisma.performanceCycle.findFirst({
    where: { status: 'active' },
    orderBy: { activatedAt: 'desc' },
  });

  if (!cycle) {
    return NextResponse.json({ cycle: null, review: null, goals: [] });
  }

  const review = await prisma.performanceReview.findFirst({
    where: { cycleId: cycle.id, employeeId: user.employeeId },
    include: {
      ratings: { orderBy: { sortOrder: 'asc' } },
      feedback: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  const goals = review
    ? await prisma.performanceGoal.findMany({
        where: { cycleId: cycle.id, employeeId: user.employeeId },
        orderBy: { sortOrder: 'asc' },
      })
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
}

export async function PATCH(request: NextRequest) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.employeeId) {
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

  const review = await prisma.performanceReview.findFirst({
    where: { id: body.reviewId, employeeId: user.employeeId },
  });
  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  }

  const now = new Date();
  const submit = body.submit === true;

  if (body.ratings?.length) {
    for (const rating of body.ratings) {
      await prisma.performanceReviewRating.updateMany({
        where: { reviewId: review.id, dimension: rating.dimension },
        data: { selfScore: rating.selfScore },
      });
    }
  }

  if (body.goals?.length) {
    for (const goal of body.goals) {
      await prisma.performanceGoal.updateMany({
        where: { id: goal.id, employeeId: user.employeeId },
        data: { selfScore: goal.selfScore },
      });
    }
  }

  const updated = await prisma.performanceReview.update({
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
  });

  if (body.selfSummary?.trim()) {
    await prisma.performanceFeedback.create({
      data: {
        organizationId: review.organizationId,
        reviewId: review.id,
        authorType: 'self',
        authorEssUserId: user.id,
        content: body.selfSummary.trim(),
      },
    });
  }

  return NextResponse.json({ review: updated });
}
