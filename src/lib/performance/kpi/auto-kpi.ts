import type { Prisma } from '@prisma/client';

import { measureAutoKpi } from '@/lib/performance/kpi/kpi-source-provider';
import { registerBuiltinKpiProviders } from '@/lib/performance/kpi/register-builtin-providers';
import type { FrozenScorecardSnapshot } from '@/lib/performance/scoring/compute-bsc-score';

export type AutoKpiRefreshResult = {
  updatedGoals: number;
  skipped: number;
};

/**
 * Pull auto-measured KPI values into performance goals for an active review.
 * Only updates goals linked to scorecard measures with a registered kpiSourceKey.
 */
export async function refreshAutoKpisForReview(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    reviewId: string;
    periodStart: Date;
    periodEnd: Date;
  },
): Promise<AutoKpiRefreshResult> {
  registerBuiltinKpiProviders();

  const review = await tx.performanceReview.findFirst({
    where: { id: input.reviewId, organizationId: input.organizationId },
  });
  if (!review?.frozenScorecardSnapshot) {
    return { updatedGoals: 0, skipped: 0 };
  }

  // Goals are keyed by cycle + employee (no direct relation on PerformanceReview).
  const goals = await tx.performanceGoal.findMany({
    where: { organizationId: input.organizationId, cycleId: review.cycleId, employeeId: review.employeeId },
  });

  const snapshot = review.frozenScorecardSnapshot as FrozenScorecardSnapshot;
  const measureById = new Map(snapshot.measures.map((m) => [m.id, m]));

  let updatedGoals = 0;
  let skipped = 0;

  for (const goal of goals) {
    if (!goal.scorecardMeasureId) {
      skipped += 1;
      continue;
    }
    const measure = measureById.get(goal.scorecardMeasureId);
    if (!measure?.kpiSourceKey) {
      skipped += 1;
      continue;
    }

    const reading = await measureAutoKpi(measure.kpiSourceKey, {
      organizationId: input.organizationId,
      employeeId: review.employeeId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      outsourcingClientId: null,
      tx,
    });

    if (!reading) {
      skipped += 1;
      continue;
    }

    await tx.performanceGoal.update({
      where: { id: goal.id },
      data: {
        description: [
          goal.description ?? '',
          `Auto KPI (${measure.kpiSourceKey}): ${reading.value}${reading.unit ?? ''}`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    });
    updatedGoals += 1;
  }

  return { updatedGoals, skipped };
}
