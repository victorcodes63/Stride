import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export type CommissionTier = {
  minAttainmentPct: number;
  ratePct: number;
};

/** Canonical commission rule config stored on SalesCommissionRule.config (SALES-05). */
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

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate / normalize commission rule JSON from API or DB.
 * Returns null when the payload is not a usable tier schedule.
 */
export function parseCommissionRuleConfig(raw: unknown): CommissionRuleConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.tiers) || obj.tiers.length === 0) return null;

  const tiers: CommissionTier[] = [];
  for (const row of obj.tiers) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const t = row as Record<string, unknown>;
    const minAttainmentPct = asFiniteNumber(t.minAttainmentPct);
    const ratePct = asFiniteNumber(t.ratePct);
    if (minAttainmentPct == null || ratePct == null || ratePct < 0) return null;
    tiers.push({ minAttainmentPct, ratePct });
  }

  const config: CommissionRuleConfig = { tiers };
  const capAmount = asFiniteNumber(obj.capAmount);
  if (capAmount != null && capAmount > 0) config.capAmount = capAmount;
  const acceleratorAbovePct = asFiniteNumber(obj.acceleratorAbovePct);
  const acceleratorMultiplier = asFiniteNumber(obj.acceleratorMultiplier);
  if (acceleratorAbovePct != null && acceleratorMultiplier != null && acceleratorMultiplier > 0) {
    config.acceleratorAbovePct = acceleratorAbovePct;
    config.acceleratorMultiplier = acceleratorMultiplier;
  }
  return config;
}

/** Estimate commission from attainment tiers. */
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

  const config = parseCommissionRuleConfig(rule.config);
  if (!config) return [];

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
