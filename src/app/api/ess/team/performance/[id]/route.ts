import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

type RouteContext = { params: Promise<{ id: string }> };

const reviewInclude = {
  employee: {
    select: {
      firstName: true,
      lastName: true,
      employeeNumber: true,
      managerEmployeeId: true,
      department: { select: { name: true } },
    },
  },
  ratings: { orderBy: { sortOrder: 'asc' as const } },
  cycle: { select: { id: true, name: true, status: true } },
} as const;

async function assertManagerAccess(reviewId: string, managerEmployeeId: string) {
  const review = await prisma.performanceReview.findUnique({
    where: { id: reviewId },
    include: reviewInclude,
  });
  if (!review || review.employee.managerEmployeeId !== managerEmployeeId) {
    return null;
  }
  return review;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.employeeId || user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const review = await assertManagerAccess(id, user.employeeId);
  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

  const goals = await prisma.performanceGoal.findMany({
    where: { cycleId: review.cycleId, employeeId: review.employeeId },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json({ review, goals });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.employeeId || user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await assertManagerAccess(id, user.employeeId);
  if (!existing) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    managerSummary?: string;
    overallManagerRating?: number;
    ratings?: Array<{ dimension: string; managerScore: number }>;
    goals?: Array<{ id: string; managerScore: number }>;
    complete?: boolean;
  };

  const now = new Date();
  const complete = body.complete === true;

  await prisma.$transaction(async (tx) => {
    if (body.ratings?.length) {
      for (const rating of body.ratings) {
        await tx.performanceReviewRating.updateMany({
          where: { reviewId: id, dimension: rating.dimension },
          data: { managerScore: rating.managerScore },
        });
      }
    }

    if (body.goals?.length) {
      for (const goal of body.goals) {
        await tx.performanceGoal.updateMany({
          where: {
            id: goal.id,
            employeeId: existing.employeeId,
            cycleId: existing.cycleId,
          },
          data: { managerScore: goal.managerScore },
        });
      }
    }

    await tx.performanceReview.update({
      where: { id },
      data: {
        managerSummary: body.managerSummary?.trim() || undefined,
        overallManagerRating: body.overallManagerRating,
        status: complete ? 'completed' : 'manager_in_progress',
        managerSubmittedAt: complete ? now : undefined,
        completedAt: complete ? now : undefined,
      },
    });
  });

  const review = await prisma.performanceReview.findUnique({
    where: { id },
    include: reviewInclude,
  });

  return NextResponse.json({ review });
}
