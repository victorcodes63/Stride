import type { Prisma } from '@prisma/client';

import type { KpiMeasurement, KpiMeasurementContext, KpiSourceProvider } from '@/lib/performance/kpi/kpi-source-provider';

export const SALES_PIPELINE_ATTAINMENT_KEY = 'sales.pipeline_attainment';

export function computePipelineAttainmentPercent(closed: number, target: number): number | null {
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(closed)) return null;
  return Math.round((closed / target) * 1000) / 10;
}

function overlapWhere(ctx: KpiMeasurementContext): Prisma.SalesRepPeriodMetricWhereInput {
  return {
    organizationId: ctx.organizationId,
    employeeId: ctx.employeeId,
    periodStart: { lte: ctx.periodEnd },
    periodEnd: { gte: ctx.periodStart },
  };
}

/** First Sales KPI provider — pipeline closed vs target for the review period. */
export const salesPipelineAttainmentProvider: KpiSourceProvider = {
  key: SALES_PIPELINE_ATTAINMENT_KEY,
  label: 'Pipeline attainment',
  module: 'sales',

  async measure(ctx) {
    const { withOrgContext } = await import('@/lib/org-context');
    const { prisma } = await import('@/lib/prisma');

    const row = await withOrgContext(ctx.organizationId, (tx) =>
      tx.salesRepPeriodMetric.findFirst({
        where: overlapWhere(ctx),
        orderBy: { periodEnd: 'desc' },
      }),
    );

    if (!row) return null;

    const target = Number(row.pipelineTarget);
    const closed = Number(row.pipelineClosed);
    const attainmentPct = computePipelineAttainmentPercent(closed, target);
    if (attainmentPct == null) return null;

    const measurement: KpiMeasurement = {
      value: attainmentPct,
      unit: '%',
      asOf: row.updatedAt.toISOString(),
    };

    return measurement;
  },
};
