import { NextRequest, NextResponse } from 'next/server';

import {
  DEFAULT_GOAL_TEMPLATES,
  DEFAULT_RATING_DIMENSIONS,
  parseCycleGoalTemplates,
  parseCycleRatingDimensions,
} from '@/lib/performance/service';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    const cycle = await ctx.run((tx) =>
      tx.performanceCycle.findFirst({ where: ctx.where({ id }) }),
    );
    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });

    return NextResponse.json({
      cycle: {
        id: cycle.id,
        name: cycle.name,
        status: cycle.status,
        goalTemplates: parseCycleGoalTemplates(cycle.goalTemplates),
        ratingDimensions: parseCycleRatingDimensions(cycle.ratingDimensions),
      },
    });
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      periodStart?: string;
      periodEnd?: string;
      goalTemplates?: Array<{ title: string; weightPercent: number; description?: string }>;
      ratingDimensions?: string[];
    };

    try {
      const updated = await ctx.run(async (tx) => {
        const cycle = await tx.performanceCycle.findFirst({ where: ctx.where({ id }) });
        if (!cycle) return null;
        if (cycle.status !== 'draft') {
          throw new Error('Only draft cycles can be edited');
        }

        if (body.goalTemplates?.length) {
          const totalWeight = body.goalTemplates.reduce((sum, g) => sum + (g.weightPercent || 0), 0);
          if (totalWeight !== 100) {
            throw new Error('Goal weights must sum to 100%');
          }
        }

        return tx.performanceCycle.update({
          where: { id },
          data: {
            name: body.name?.trim() || undefined,
            description: body.description !== undefined ? body.description.trim() || null : undefined,
            periodStart: body.periodStart ? new Date(`${body.periodStart}T00:00:00.000Z`) : undefined,
            periodEnd: body.periodEnd ? new Date(`${body.periodEnd}T00:00:00.000Z`) : undefined,
            goalTemplates: body.goalTemplates
              ? (body.goalTemplates as unknown as object)
              : undefined,
            ratingDimensions: body.ratingDimensions?.length
              ? (body.ratingDimensions as unknown as object)
              : undefined,
          },
        });
      });

      if (!updated) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });

      return NextResponse.json({
        cycle: {
          ...updated,
          goalTemplates: parseCycleGoalTemplates(updated.goalTemplates),
          ratingDimensions: parseCycleRatingDimensions(updated.ratingDimensions),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
