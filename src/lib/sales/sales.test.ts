import { describe, expect, it } from 'vitest';

import { computeAttainmentPercent, parsePeriodBounds } from '@/lib/sales/schema';
import { computeCommissionFromAttainment } from '@/lib/sales/commission';

describe('sales schema helpers', () => {
  it('parses month period bounds', () => {
    const { periodStart, periodEnd } = parsePeriodBounds('month', new Date('2026-03-15T12:00:00.000Z'));
    expect(periodStart.toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(periodEnd.toISOString().slice(0, 10)).toBe('2026-03-31');
  });

  it('computes attainment percent', () => {
    expect(computeAttainmentPercent(750000, 1000000)).toBe(75);
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
});
