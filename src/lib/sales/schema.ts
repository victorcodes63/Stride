/** Sales Performance module — shared constants and validation helpers. */

export const SALES_DEAL_STAGES = [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
] as const;

export type SalesDealStage = (typeof SALES_DEAL_STAGES)[number];

export const SALES_FORECAST_CATEGORIES = ['pipeline', 'best_case', 'commit', 'omitted'] as const;
export type SalesForecastCategory = (typeof SALES_FORECAST_CATEGORIES)[number];

export const SALES_DEAL_ACTIVITY_TYPES = ['call', 'email', 'meeting', 'note', 'task'] as const;
export type SalesDealActivityType = (typeof SALES_DEAL_ACTIVITY_TYPES)[number];

export const SALES_TARGET_PERIOD_TYPES = ['month', 'quarter', 'year'] as const;
export type SalesTargetPeriodType = (typeof SALES_TARGET_PERIOD_TYPES)[number];

export const SALES_TARGET_STATUSES = ['draft', 'pending_approval', 'approved'] as const;
export type SalesTargetStatus = (typeof SALES_TARGET_STATUSES)[number];

export const SALES_ACTUAL_SOURCES = ['manual', 'deal', 'finance_invoice'] as const;
export type SalesActualSource = (typeof SALES_ACTUAL_SOURCES)[number];

export const SALES_LEAD_RATINGS = ['hot', 'warm', 'cold'] as const;
export type SalesLeadRating = (typeof SALES_LEAD_RATINGS)[number];

export const SALES_TASK_STATUSES = ['open', 'completed', 'cancelled'] as const;
export type SalesTaskStatus = (typeof SALES_TASK_STATUSES)[number];

export const SALES_QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const;
export type SalesQuoteStatus = (typeof SALES_QUOTE_STATUSES)[number];

/** Terminal (closed) pipeline stages. */
export const CLOSED_STAGES: SalesDealStage[] = ['won', 'lost'];

/**
 * Days a deal may sit idle in a stage before it is considered "rotting".
 * Later stages get shorter fuses since momentum matters more near the close.
 */
export const STAGE_ROTTING_THRESHOLD_DAYS: Record<SalesDealStage, number> = {
  lead: 21,
  qualified: 14,
  proposal: 10,
  negotiation: 7,
  won: Number.POSITIVE_INFINITY,
  lost: Number.POSITIVE_INFINITY,
};

const STAGE_LABELS: Record<SalesDealStage, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage as SalesDealStage] ?? stage;
}

/** Default win probability (%) by pipeline stage. */
export const STAGE_DEFAULT_PROBABILITY: Record<SalesDealStage, number> = {
  lead: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 75,
  won: 100,
  lost: 0,
};

export const STAGE_DEFAULT_FORECAST: Record<SalesDealStage, SalesForecastCategory> = {
  lead: 'pipeline',
  qualified: 'pipeline',
  proposal: 'best_case',
  negotiation: 'commit',
  won: 'omitted',
  lost: 'omitted',
};

export const OPEN_PIPELINE_STAGES: SalesDealStage[] = [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
];

export function parsePeriodBounds(
  periodType: SalesTargetPeriodType,
  anchor: Date,
): { periodStart: Date; periodEnd: Date } {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  if (periodType === 'month') {
    return {
      periodStart: new Date(Date.UTC(y, m, 1)),
      periodEnd: new Date(Date.UTC(y, m + 1, 0)),
    };
  }
  if (periodType === 'quarter') {
    const qStart = Math.floor(m / 3) * 3;
    return {
      periodStart: new Date(Date.UTC(y, qStart, 1)),
      periodEnd: new Date(Date.UTC(y, qStart + 3, 0)),
    };
  }
  return {
    periodStart: new Date(Date.UTC(y, 0, 1)),
    periodEnd: new Date(Date.UTC(y, 11, 31)),
  };
}

export function computeAttainmentPercent(actual: number, target: number): number | null {
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(actual)) return null;
  return Math.round((actual / target) * 1000) / 10;
}

/** Weighted pipeline = Σ (open deal value × probability/100). */
export function computeWeightedPipeline(
  deals: Array<{ value: number; probability: number; stage: string }>,
): number {
  return deals.reduce((sum, d) => {
    if (!OPEN_PIPELINE_STAGES.includes(d.stage as SalesDealStage)) return sum;
    const p = Number.isFinite(d.probability) ? d.probability : 0;
    const v = Number.isFinite(d.value) ? d.value : 0;
    return sum + v * (Math.min(100, Math.max(0, p)) / 100);
  }, 0);
}

/** Coverage = weighted open pipeline ÷ remaining quota (null if remaining ≤ 0). */
export function computePipelineCoverage(
  weightedPipeline: number,
  teamTarget: number,
  closedRevenue: number,
): number | null {
  if (!Number.isFinite(teamTarget) || !Number.isFinite(closedRevenue)) return null;
  const remaining = teamTarget - closedRevenue;
  if (remaining <= 0) return null;
  if (!Number.isFinite(weightedPipeline)) return null;
  return Math.round((weightedPipeline / remaining) * 100) / 100;
}

export function defaultProbabilityForStage(stage: SalesDealStage): number {
  return STAGE_DEFAULT_PROBABILITY[stage];
}

export function defaultForecastForStage(stage: SalesDealStage): SalesForecastCategory {
  return STAGE_DEFAULT_FORECAST[stage];
}
