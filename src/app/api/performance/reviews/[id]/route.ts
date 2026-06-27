import { NextRequest, NextResponse } from 'next/server';

import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

const reviewInclude = {
  employee: {
    select: {
      firstName: true,
      lastName: true,
      employeeNumber: true,
      department: { select: { name: true } },
    },
  },
  ratings: { orderBy: { sortOrder: 'asc' as const } },
  feedback: { orderBy: { createdAt: 'desc' as const } },
  cycle: { select: { id: true, name: true, status: true } },
} as const;

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    const review = await ctx.run((tx) =>
      tx.performanceReview.findFirst({
        where: ctx.where({ id }),
        include: reviewInclude,
      }),
    );

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const goals = await ctx.run((tx) =>
      tx.performanceGoal.findMany({
        where: ctx.where({
          cycleId: review.cycleId,
          employeeId: review.employeeId,
        }),
        orderBy: { sortOrder: 'asc' },
      }),
    );

    return NextResponse.json({ review, goals });
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    const body = (await request.json().catch(() => ({}))) as {
      managerSummary?: string;
      overallManagerRating?: number;
      ratings?: Array<{ dimension: string; managerScore: number }>;
      goals?: Array<{ id: string; managerScore: number }>;
      complete?: boolean;
    };

    const review = await ctx.run((tx) =>
      tx.performanceReview.findFirst({ where: ctx.where({ id }) }),
    );
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const now = new Date();
    const complete = body.complete === true;

    await ctx.run(async (tx) => {
      if (body.ratings?.length) {
        for (const rating of body.ratings) {
          await tx.performanceReviewRating.updateMany({
            where: {
              reviewId: id,
              organizationId: ctx.organizationId,
              dimension: rating.dimension,
            },
            data: { managerScore: rating.managerScore },
          });
        }
      }

      if (body.goals?.length) {
        for (const goal of body.goals) {
          await tx.performanceGoal.updateMany({
            where: {
              id: goal.id,
              organizationId: ctx.organizationId,
              employeeId: review.employeeId,
              cycleId: review.cycleId,
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

      if (body.managerSummary?.trim()) {
        await tx.performanceFeedback.create({
          data: {
            organizationId: ctx.organizationId,
            reviewId: id,
            authorType: 'manager',
            authorUserId: ctx.staff.id,
            content: body.managerSummary.trim(),
          },
        });
      }
    });

    const updated = await ctx.run((tx) =>
      tx.performanceReview.findFirst({
        where: ctx.where({ id }),
        include: reviewInclude,
      }),
    );

    await ctx.audit({
      action: complete ? 'performance.review.completed' : 'performance.review.manager_updated',
      entityType: 'PerformanceReview',
      entityId: id,
      route: 'PATCH /api/performance/reviews/[id]',
    });

    return NextResponse.json({ review: updated });
  });
}
