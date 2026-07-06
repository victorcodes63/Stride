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

export const SALES_TARGET_PERIOD_TYPES = ['month', 'quarter', 'year'] as const;
export type SalesTargetPeriodType = (typeof SALES_TARGET_PERIOD_TYPES)[number];

export const SALES_TARGET_STATUSES = ['draft', 'pending_approval', 'approved'] as const;
export type SalesTargetStatus = (typeof SALES_TARGET_STATUSES)[number];

export const SALES_ACTUAL_SOURCES = ['manual', 'deal', 'finance_invoice'] as const;
export type SalesActualSource = (typeof SALES_ACTUAL_SOURCES)[number];

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
