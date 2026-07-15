import type { Prisma } from '@prisma/client';
import { OPEN_PIPELINE_STAGES, type SalesForecastCategory } from '@/lib/sales/schema';

export type ForecastRollup = {
  commitAmount: number;
  bestCaseAmount: number;
  pipelineAmount: number;
  closedAmount: number;
  omittedAmount: number;
  weightedOpen: number;
  dealCountByCategory: Record<SalesForecastCategory, number>;
};

export function rollupForecastFromDeals(
  deals: Array<{
    value: unknown;
    probability: number;
    stage: string;
    forecastCategory: string;
  }>,
): ForecastRollup {
  const sums: ForecastRollup = {
    commitAmount: 0,
    bestCaseAmount: 0,
    pipelineAmount: 0,
    closedAmount: 0,
    omittedAmount: 0,
    weightedOpen: 0,
    dealCountByCategory: {
      commit: 0,
      best_case: 0,
      pipeline: 0,
      omitted: 0,
    },
  };

  for (const d of deals) {
    const value = Number(d.value);
    if (!Number.isFinite(value)) continue;
    const cat = d.forecastCategory as SalesForecastCategory;
    if (cat in sums.dealCountByCategory) {
      sums.dealCountByCategory[cat] += 1;
    }

    if (d.stage === 'won') {
      sums.closedAmount += value;
      continue;
    }
    if (d.stage === 'lost' || cat === 'omitted') {
      sums.omittedAmount += value;
      continue;
    }

    if (cat === 'commit') sums.commitAmount += value;
    else if (cat === 'best_case') sums.bestCaseAmount += value;
    else sums.pipelineAmount += value;

    if (OPEN_PIPELINE_STAGES.includes(d.stage as never)) {
      sums.weightedOpen += value * (Math.min(100, Math.max(0, d.probability)) / 100);
    }
  }

  for (const key of [
    'commitAmount',
    'bestCaseAmount',
    'pipelineAmount',
    'closedAmount',
    'omittedAmount',
    'weightedOpen',
  ] as const) {
    sums[key] = Math.round(sums[key] * 100) / 100;
  }

  return sums;
}

export async function loadPeriodForecastDeals(
  tx: Prisma.TransactionClient,
  organizationId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  return tx.salesDeal.findMany({
    where: {
      organizationId,
      OR: [
        {
          expectedCloseDate: { gte: periodStart, lte: periodEnd },
        },
        {
          stage: 'won',
          closedAt: { gte: periodStart, lte: new Date(periodEnd.getTime() + 86_400_000 - 1) },
        },
        {
          stage: { in: ['lead', 'qualified', 'proposal', 'negotiation'] },
          expectedCloseDate: null,
        },
      ],
    },
    select: {
      id: true,
      name: true,
      stage: true,
      value: true,
      probability: true,
      forecastCategory: true,
      expectedCloseDate: true,
      ownerEmployeeId: true,
      currency: true,
    },
  });
}
