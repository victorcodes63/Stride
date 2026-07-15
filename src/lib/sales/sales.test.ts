import { describe, expect, it } from 'vitest';

import { computeCommissionFromAttainment } from '@/lib/sales/commission';
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
    expect(computeAttainmentPercent(750000, 1000000)).toBe(75);
  });

  it('applies stage default probability and forecast', () => {
    expect(defaultProbabilityForStage('negotiation')).toBe(75);
    expect(defaultForecastForStage('proposal')).toBe('best_case');
    expect(defaultForecastForStage('won')).toBe('omitted');
  });

  it('computes weighted pipeline from open deals only', () => {
    const weighted = computeWeightedPipeline([
      { value: 1_000_000, probability: 50, stage: 'proposal' },
      { value: 2_000_000, probability: 75, stage: 'negotiation' },
      { value: 500_000, probability: 100, stage: 'won' },
    ]);
    expect(weighted).toBe(2_000_000);
  });

  it('computes pipeline coverage vs remaining quota', () => {
    expect(computePipelineCoverage(3_000_000, 5_000_000, 1_000_000)).toBe(0.75);
    expect(computePipelineCoverage(1_000_000, 1_000_000, 1_000_000)).toBeNull();
  });
});

describe('sales commission', () => {
  it('applies tier rate from attainment', () => {
    const amount = computeCommissionFromAttainment(110, 100000, {
      tiers: [
        { minAttainmentPct: 100, ratePct: 10 },
        { minAttainmentPct: 80, ratePct: 5 },
      ],
    });
    expect(amount).toBe(10000);
  });

  it('applies accelerator and cap', () => {
    const amount = computeCommissionFromAttainment(130, 200_000, {
      tiers: [{ minAttainmentPct: 100, ratePct: 5 }],
      acceleratorAbovePct: 120,
      acceleratorMultiplier: 1.5,
      capAmount: 12_000,
    });
    // 200000 * 5% * 1.5 = 15000 → capped at 12000
    expect(amount).toBe(12_000);
  });
});
