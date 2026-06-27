import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { withEssTenant, type EssTenantContext } from '@/lib/ess-tenant-api';

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

async function assertManagerAccess(
  tx: Prisma.TransactionClient,
  ctx: EssTenantContext,
  reviewId: string,
  managerEmployeeId: string,
) {
  const review = await tx.performanceReview.findFirst({
    where: ctx.where({ id: reviewId }),
    include: reviewInclude,
  });
  if (!review || review.employee.managerEmployeeId !== managerEmployeeId) {
    return null;
  }
  return review;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId || ctx.essUser.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const result = await ctx.run(async (tx) => {
      const review = await assertManagerAccess(tx, ctx, id, ctx.employeeId!);
      if (!review) return null;

      const goals = await tx.performanceGoal.findMany({
        where: ctx.where({ cycleId: review.cycleId, employeeId: review.employeeId }),
        orderBy: { sortOrder: 'asc' },
      });

      return { review, goals };
    });

    if (!result) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    return NextResponse.json(result);
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId || ctx.essUser.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      managerSummary?: string;
      overallManagerRating?: number;
      ratings?: Array<{ dimension: string; managerScore: number }>;
      goals?: Array<{ id: string; managerScore: number }>;
      complete?: boolean;
    };

    const now = new Date();
    const complete = body.complete === true;

    const patchOk = await ctx.run(async (tx) => {
      const existing = await assertManagerAccess(tx, ctx, id, ctx.employeeId!);
      if (!existing) return false;

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
            where: ctx.where({
              id: goal.id,
              employeeId: existing.employeeId,
              cycleId: existing.cycleId,
            }),
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

      return true;
    });

    if (!patchOk) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    const review = await ctx.run((tx) =>
      tx.performanceReview.findFirst({
        where: ctx.where({ id }),
        include: reviewInclude,
      }),
    );

    return NextResponse.json({ review });
  });
}
