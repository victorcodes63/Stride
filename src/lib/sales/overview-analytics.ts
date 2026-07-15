import type { Prisma, PrismaClient } from '@prisma/client';

import { buildAttainmentReport } from '@/lib/sales/attainment-analytics';
import {
  computePipelineCoverage,
  computeWeightedPipeline,
  OPEN_PIPELINE_STAGES,
  SALES_DEAL_STAGES,
  type SalesDealStage,
} from '@/lib/sales/schema';

type Db = PrismaClient | Prisma.TransactionClient;

export type SalesOverview = {
  periodStart: string;
  periodEnd: string;
  currency: string;
  teamTarget: number;
  closedRevenue: number;
  attainmentPct: number | null;
  weightedPipeline: number;
  coverage: number | null;
  dealsClosingThisPeriod: number;
  funnel: Array<{ stage: SalesDealStage; count: number; value: number }>;
  weekMovements: Array<{ fromStage: string | null; toStage: string; count: number }>;
};

export async function buildSalesOverview(
  db: Db,
  params: { organizationId: string; periodStart: Date; periodEnd: Date },
): Promise<SalesOverview> {
  const attainment = await buildAttainmentReport(db, params);

  const deals = await db.salesDeal.findMany({
    where: { organizationId: params.organizationId },
    select: { stage: true, value: true, probability: true, expectedCloseDate: true },
  });

  const weightedPipeline = Math.round(
    computeWeightedPipeline(
      deals.map((d) => ({
        stage: d.stage,
        value: Number(d.value),
        probability: d.probability,
      })),
    ) * 100,
  ) / 100;

  const teamTarget = attainment.teamTotals.target;
  const closedRevenue = attainment.teamTotals.actual;

  const coverage = computePipelineCoverage(weightedPipeline, teamTarget, closedRevenue);

  const dealsClosingThisPeriod = deals.filter((d) => {
    if (!d.expectedCloseDate) return false;
    if (!OPEN_PIPELINE_STAGES.includes(d.stage as SalesDealStage)) return false;
    const close = d.expectedCloseDate.getTime();
    return close >= params.periodStart.getTime() && close <= params.periodEnd.getTime();
  }).length;

  const funnel = SALES_DEAL_STAGES.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage);
    return {
      stage,
      count: stageDeals.length,
      value: Math.round(stageDeals.reduce((s, d) => s + Number(d.value), 0) * 100) / 100,
    };
  });

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const recentHistory = await db.salesDealStageHistory.findMany({
    where: {
      organizationId: params.organizationId,
      changedAt: { gte: weekAgo },
    },
    select: { fromStage: true, toStage: true },
  });

  const movementMap = new Map<string, number>();
  for (const row of recentHistory) {
    const key = `${row.fromStage ?? 'null'}::${row.toStage}`;
    movementMap.set(key, (movementMap.get(key) ?? 0) + 1);
  }

  const weekMovements = [...movementMap.entries()]
    .map(([key, count]) => {
      const [fromStage, toStage] = key.split('::');
      return {
        fromStage: fromStage === 'null' ? null : fromStage,
        toStage,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    periodStart: params.periodStart.toISOString().slice(0, 10),
    periodEnd: params.periodEnd.toISOString().slice(0, 10),
    currency: attainment.currency,
    teamTarget,
    closedRevenue,
    attainmentPct: attainment.teamTotals.attainmentPct,
    weightedPipeline,
    coverage,
    dealsClosingThisPeriod,
    funnel,
    weekMovements,
  };
}
