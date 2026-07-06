import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export type CommissionTier = {
  minAttainmentPct: number;
  ratePct: number;
};

export type CommissionRuleConfig = {
  tiers: CommissionTier[];
  capAmount?: number;
  acceleratorAbovePct?: number;
  acceleratorMultiplier?: number;
};

export type CommissionEstimate = {
  employeeId: string;
  attainmentPct: number | null;
  revenue: number;
  commissionAmount: number;
  currency: string;
  ruleName: string;
};

/** VICTOR TODO: hand off computed commission to payroll disbursement (SALES-05). */
export function computeCommissionFromAttainment(
  attainmentPct: number | null,
  revenue: number,
  config: CommissionRuleConfig,
): number {
  if (attainmentPct == null || revenue <= 0) return 0;
  const sorted = [...config.tiers].sort((a, b) => b.minAttainmentPct - a.minAttainmentPct);
  const tier = sorted.find((t) => attainmentPct >= t.minAttainmentPct) ?? sorted[sorted.length - 1];
  if (!tier) return 0;
  let amount = Math.round(revenue * (tier.ratePct / 100) * 100) / 100;
  if (
    config.acceleratorAbovePct != null &&
    config.acceleratorMultiplier != null &&
    attainmentPct >= config.acceleratorAbovePct
  ) {
    amount = Math.round(amount * config.acceleratorMultiplier * 100) / 100;
  }
  if (config.capAmount != null) {
    amount = Math.min(amount, config.capAmount);
  }
  return amount;
}

export async function estimateCommissionsForPeriod(
  db: Db,
  params: { organizationId: string; periodStart: Date; periodEnd: Date },
): Promise<CommissionEstimate[]> {
  const rule = await db.salesCommissionRule.findFirst({
    where: { organizationId: params.organizationId, status: 'active' },
    orderBy: { updatedAt: 'desc' },
  });
  if (!rule) return [];

  const config = rule.config as CommissionRuleConfig;
  const metrics = await db.salesRepPeriodMetric.findMany({
    where: {
      organizationId: params.organizationId,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
    },
  });

  return metrics.map((m) => {
    const target = Number(m.pipelineTarget);
    const actual = Number(m.pipelineClosed);
    const attainmentPct = target > 0 ? Math.round((actual / target) * 1000) / 10 : null;
    return {
      employeeId: m.employeeId,
      attainmentPct,
      revenue: actual,
      commissionAmount: computeCommissionFromAttainment(attainmentPct, actual, config),
      currency: m.currency,
      ruleName: rule.name,
    };
  });
}
