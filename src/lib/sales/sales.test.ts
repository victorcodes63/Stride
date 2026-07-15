import { describe, expect, it } from 'vitest';

import { lineItemExtendedAmount } from '@/lib/sales/access';
import { computeCommissionFromAttainment } from '@/lib/sales/commission';
import { rollupForecastFromDeals } from '@/lib/sales/forecast';
import {
  computeAttainmentPercent,
  computePipelineCoverage,
  computeWeightedPipeline,
  defaultForecastForStage,
  defaultProbabilityForStage,
  parsePeriodBounds,
} from '@/lib/sales/schema';

describe('sales schema helpers', () => {
  it('parses month period bounds', () => {
    const { periodStart, periodEnd } = parsePeriodBounds('month', new Date('2026-03-15T12:00:00.000Z'));
    expect(periodStart.toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(periodEnd.toISOString().slice(0, 10)).toBe('2026-03-31');
  });

  it('computes attainment percent', () => {
    expect(computeAttainmentPercent(50, 100)).toBe(50);
    expect(computeAttainmentPercent(0, 0)).toBeNull();
  });

  it('weights open pipeline by probability', () => {
    expect(
      computeWeightedPipeline([
        { value: 1000, probability: 50, stage: 'proposal' },
        { value: 2000, probability: 100, stage: 'won' },
      ]),
    ).toBe(500);
  });

  it('computes coverage vs remaining quota', () => {
    expect(computePipelineCoverage(500_000, 1_000_000, 200_000)).toBe(0.63);
    expect(computePipelineCoverage(100, 100, 100)).toBeNull();
  });

  it('defaults stage probability and forecast', () => {
    expect(defaultProbabilityForStage('negotiation')).toBe(75);
    expect(defaultForecastForStage('lead')).toBe('pipeline');
  });
});

describe('commission tiers', () => {
  it('picks matching tier and respects cap', () => {
    const config = {
      tiers: [
        { minAttainmentPct: 0, ratePct: 2 },
        { minAttainmentPct: 100, ratePct: 5 },
      ],
      capAmount: 10_000,
    };
    expect(computeCommissionFromAttainment(100, 1_000_000, config)).toBe(10_000);
  });
});

describe('phase 2 helpers', () => {
  it('extends line item amount with discount and term', () => {
    expect(
      lineItemExtendedAmount({
        quantity: 2,
        unitPrice: 1000,
        discountPct: 10,
        isRecurring: true,
        termMonths: 3,
      }),
    ).toBe(5400);
  });

  it('rollups forecast categories', () => {
    const rollup = rollupForecastFromDeals([
      { value: 100, probability: 100, stage: 'negotiation', forecastCategory: 'commit' },
      { value: 200, probability: 50, stage: 'proposal', forecastCategory: 'best_case' },
      { value: 50, probability: 100, stage: 'won', forecastCategory: 'omitted' },
    ]);
    expect(rollup.commitAmount).toBe(100);
    expect(rollup.bestCaseAmount).toBe(200);
    expect(rollup.closedAmount).toBe(50);
    expect(rollup.weightedOpen).toBe(200);
  });
});
