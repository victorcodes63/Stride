/**
 * Sales Performance — pure analytics helpers.
 *
 * All functions are side-effect free and framework-agnostic so they can be unit
 * tested and reused by API routes (Stream B) and the overview UI.
 */

import {
  CLOSED_STAGES,
  OPEN_PIPELINE_STAGES,
  SALES_DEAL_STAGES,
  STAGE_ROTTING_THRESHOLD_DAYS,
  type SalesDealStage,
} from '@/lib/sales/schema';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type AnalyticsDeal = {
  stage: string;
  value: number;
  probability?: number;
  createdAt: string | Date;
  closedAt?: string | Date | null;
  stageEnteredAt?: string | Date | null;
  lastActivityAt?: string | Date | null;
};

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole days between two dates (>= 0), or null if either is missing. */
export function daysBetween(
  from: string | Date | null | undefined,
  to: string | Date | null | undefined,
): number | null {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return null;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / MS_PER_DAY));
}

/**
 * Win rate = won / (won + lost), as a percentage (0-100), rounded to 1 dp.
 * Returns null when there are no closed deals.
 */
export function computeWinRate(deals: Array<{ stage: string }>): number | null {
  let won = 0;
  let lost = 0;
  for (const d of deals) {
    if (d.stage === 'won') won += 1;
    else if (d.stage === 'lost') lost += 1;
  }
  const closed = won + lost;
  if (closed === 0) return null;
  return Math.round((won / closed) * 1000) / 10;
}

/**
 * Average sales cycle length (days) for won deals: createdAt -> closedAt.
 * Returns null when no won deal has both timestamps.
 */
export function avgSalesCycleDays(deals: AnalyticsDeal[]): number | null {
  const spans: number[] = [];
  for (const d of deals) {
    if (d.stage !== 'won') continue;
    const span = daysBetween(d.createdAt, d.closedAt ?? null);
    if (span != null) spans.push(span);
  }
  if (spans.length === 0) return null;
  return Math.round((spans.reduce((s, n) => s + n, 0) / spans.length) * 10) / 10;
}

/** Average value of won deals, or null when there are none. */
export function avgWonDealValue(deals: AnalyticsDeal[]): number | null {
  const won = deals.filter((d) => d.stage === 'won');
  if (won.length === 0) return null;
  const total = won.reduce((s, d) => s + (Number.isFinite(d.value) ? d.value : 0), 0);
  return Math.round((total / won.length) * 100) / 100;
}

/**
 * Sales velocity ($ per day):
 *   (open opportunities x avg deal value x win rate) / avg cycle length.
 * Returns 0 when inputs are insufficient (e.g. no cycle data yet).
 */
export function computeSalesVelocity(deals: AnalyticsDeal[]): number {
  const openCount = deals.filter((d) =>
    OPEN_PIPELINE_STAGES.includes(d.stage as SalesDealStage),
  ).length;
  const winRate = computeWinRate(deals);
  const avgValue = avgWonDealValue(deals);
  const cycle = avgSalesCycleDays(deals);
  if (!openCount || winRate == null || avgValue == null || !cycle) return 0;
  return Math.round(((openCount * avgValue * (winRate / 100)) / cycle) * 100) / 100;
}

export type StageConversion = {
  fromStage: SalesDealStage;
  toStage: SalesDealStage;
  fromCount: number;
  toCount: number;
  ratePct: number | null;
};

/**
 * Funnel conversion between consecutive open stages, using each deal's furthest
 * stage reached. Deals in a later stage (or won) count as having "passed
 * through" earlier stages.
 */
export function stageConversionRates(deals: Array<{ stage: string }>): StageConversion[] {
  const order: SalesDealStage[] = [...OPEN_PIPELINE_STAGES, 'won'];
  const rankOf = (stage: string) => order.indexOf(stage as SalesDealStage);
  const reached: Record<string, number> = {};
  for (const stage of order) reached[stage] = 0;

  for (const d of deals) {
    if (d.stage === 'lost') continue;
    const rank = rankOf(d.stage);
    if (rank < 0) continue;
    for (let i = 0; i <= rank; i += 1) reached[order[i]] += 1;
  }

  const conversions: StageConversion[] = [];
  for (let i = 0; i < order.length - 1; i += 1) {
    const fromStage = order[i];
    const toStage = order[i + 1];
    const fromCount = reached[fromStage];
    const toCount = reached[toStage];
    conversions.push({
      fromStage,
      toStage,
      fromCount,
      toCount,
      ratePct: fromCount > 0 ? Math.round((toCount / fromCount) * 1000) / 10 : null,
    });
  }
  return conversions;
}

/**
 * Days a deal has been idle: prefer lastActivityAt, fall back to stageEnteredAt,
 * then createdAt. Closed deals never rot.
 */
export function dealIdleDays(deal: AnalyticsDeal, now: Date = new Date()): number | null {
  if (CLOSED_STAGES.includes(deal.stage as SalesDealStage)) return null;
  const anchor = deal.lastActivityAt ?? deal.stageEnteredAt ?? deal.createdAt;
  return daysBetween(anchor, now);
}

/** True when a deal has been idle past its stage's rotting threshold. */
export function isDealRotting(deal: AnalyticsDeal, now: Date = new Date()): boolean {
  const idle = dealIdleDays(deal, now);
  if (idle == null) return false;
  const threshold = STAGE_ROTTING_THRESHOLD_DAYS[deal.stage as SalesDealStage];
  return Number.isFinite(threshold) && idle > threshold;
}

export type FunnelBucket = { stage: SalesDealStage; count: number; value: number };

/** Count + value of deals per stage, in canonical stage order. */
export function funnelByStage(deals: AnalyticsDeal[]): FunnelBucket[] {
  const buckets = new Map<SalesDealStage, FunnelBucket>();
  for (const stage of SALES_DEAL_STAGES) buckets.set(stage, { stage, count: 0, value: 0 });
  for (const d of deals) {
    const bucket = buckets.get(d.stage as SalesDealStage);
    if (!bucket) continue;
    bucket.count += 1;
    bucket.value += Number.isFinite(d.value) ? d.value : 0;
  }
  return [...buckets.values()];
}

export type TrendPoint = { month: string; won: number; created: number; wonValue: number };

/**
 * Monthly won/created counts and won value across the trailing `months` window.
 * `month` keys are YYYY-MM.
 */
export function monthlyTrend(deals: AnalyticsDeal[], months = 6, now: Date = new Date()): TrendPoint[] {
  const points: TrendPoint[] = [];
  const index = new Map<string, TrendPoint>();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const point: TrendPoint = { month: key, won: 0, created: 0, wonValue: 0 };
    points.push(point);
    index.set(key, point);
  }
  const keyOf = (value: string | Date | null | undefined) => {
    const d = toDate(value);
    if (!d) return null;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  for (const deal of deals) {
    const createdKey = keyOf(deal.createdAt);
    if (createdKey && index.has(createdKey)) index.get(createdKey)!.created += 1;
    if (deal.stage === 'won') {
      const wonKey = keyOf(deal.closedAt ?? deal.createdAt);
      if (wonKey && index.has(wonKey)) {
        const p = index.get(wonKey)!;
        p.won += 1;
        p.wonValue += Number.isFinite(deal.value) ? deal.value : 0;
      }
    }
  }
  return points;
}
