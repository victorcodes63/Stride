import { describe, expect, it } from 'vitest';

import {
  avgSalesCycleDays,
  avgWonDealValue,
  computeSalesVelocity,
  computeWinRate,
  daysBetween,
  dealIdleDays,
  funnelByStage,
  isDealRotting,
  monthlyTrend,
  stageConversionRates,
  type AnalyticsDeal,
} from '@/lib/sales/analytics';

const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe('computeWinRate', () => {
  it('returns won / (won+lost) as a percentage', () => {
    expect(
      computeWinRate([{ stage: 'won' }, { stage: 'won' }, { stage: 'lost' }, { stage: 'proposal' }]),
    ).toBe(66.7);
  });
  it('returns null with no closed deals', () => {
    expect(computeWinRate([{ stage: 'proposal' }, { stage: 'lead' }])).toBeNull();
  });
});

describe('daysBetween', () => {
  it('counts whole days and clamps to >= 0', () => {
    expect(daysBetween(day('2026-01-01'), day('2026-01-11'))).toBe(10);
    expect(daysBetween(day('2026-01-11'), day('2026-01-01'))).toBe(0);
    expect(daysBetween(null, day('2026-01-01'))).toBeNull();
  });
});

describe('avgSalesCycleDays + avgWonDealValue', () => {
  const deals: AnalyticsDeal[] = [
    { stage: 'won', value: 1000, createdAt: day('2026-01-01'), closedAt: day('2026-01-11') },
    { stage: 'won', value: 3000, createdAt: day('2026-01-01'), closedAt: day('2026-01-21') },
    { stage: 'lost', value: 5000, createdAt: day('2026-01-01'), closedAt: day('2026-01-05') },
  ];
  it('averages cycle length over won deals only', () => {
    expect(avgSalesCycleDays(deals)).toBe(15);
  });
  it('averages won deal value', () => {
    expect(avgWonDealValue(deals)).toBe(2000);
  });
});

describe('computeSalesVelocity', () => {
  it('is zero when cycle data is missing', () => {
    expect(computeSalesVelocity([{ stage: 'qualified', value: 1000, createdAt: day('2026-01-01') }])).toBe(0);
  });
  it('computes openCount * avgValue * winRate / cycle', () => {
    const deals: AnalyticsDeal[] = [
      { stage: 'qualified', value: 2000, createdAt: day('2026-01-01') },
      { stage: 'proposal', value: 2000, createdAt: day('2026-01-01') },
      { stage: 'won', value: 2000, createdAt: day('2026-01-01'), closedAt: day('2026-01-11') },
      { stage: 'lost', value: 2000, createdAt: day('2026-01-01'), closedAt: day('2026-01-06') },
    ];
    // open=2, avgValue=2000, winRate=0.5, cycle=10 -> 2*2000*0.5/10 = 200
    expect(computeSalesVelocity(deals)).toBe(200);
  });
});

describe('stageConversionRates', () => {
  it('treats later-stage deals as having passed earlier stages', () => {
    const conv = stageConversionRates([
      { stage: 'lead' },
      { stage: 'qualified' },
      { stage: 'proposal' },
      { stage: 'won' },
      { stage: 'lost' },
    ]);
    const leadToQ = conv.find((c) => c.fromStage === 'lead' && c.toStage === 'qualified');
    expect(leadToQ?.fromCount).toBe(4); // lead,qualified,proposal,won (lost excluded)
    expect(leadToQ?.toCount).toBe(3); // qualified,proposal,won
    expect(leadToQ?.ratePct).toBe(75);
  });
});

describe('funnelByStage', () => {
  it('buckets counts and values per stage in canonical order', () => {
    const funnel = funnelByStage([
      { stage: 'lead', value: 100, createdAt: day('2026-01-01') },
      { stage: 'lead', value: 200, createdAt: day('2026-01-01') },
      { stage: 'won', value: 500, createdAt: day('2026-01-01') },
    ]);
    expect(funnel[0]).toEqual({ stage: 'lead', count: 2, value: 300 });
    expect(funnel.find((f) => f.stage === 'won')).toEqual({ stage: 'won', count: 1, value: 500 });
  });
});

describe('dealIdleDays + isDealRotting', () => {
  const now = day('2026-02-01');
  it('uses lastActivityAt then stageEnteredAt then createdAt', () => {
    expect(
      dealIdleDays({ stage: 'proposal', value: 1, createdAt: day('2026-01-01'), lastActivityAt: day('2026-01-30') }, now),
    ).toBe(2);
    expect(dealIdleDays({ stage: 'proposal', value: 1, createdAt: day('2026-01-20') }, now)).toBe(12);
  });
  it('never marks closed deals as rotting', () => {
    expect(dealIdleDays({ stage: 'won', value: 1, createdAt: day('2025-01-01') }, now)).toBeNull();
    expect(isDealRotting({ stage: 'won', value: 1, createdAt: day('2025-01-01') }, now)).toBe(false);
  });
  it('flags stale open deals past the stage threshold', () => {
    // proposal threshold is 10 days; 12 idle -> rotting
    expect(isDealRotting({ stage: 'proposal', value: 1, createdAt: day('2026-01-20') }, now)).toBe(true);
    expect(isDealRotting({ stage: 'lead', value: 1, createdAt: day('2026-01-20') }, now)).toBe(false);
  });
});

describe('monthlyTrend', () => {
  it('produces a trailing window keyed YYYY-MM with won/created tallies', () => {
    const now = day('2026-03-15');
    const points = monthlyTrend(
      [
        { stage: 'won', value: 1000, createdAt: day('2026-02-02'), closedAt: day('2026-03-02') },
        { stage: 'lead', value: 500, createdAt: day('2026-03-05') },
      ],
      3,
      now,
    );
    expect(points).toHaveLength(3);
    expect(points[points.length - 1].month).toBe('2026-03');
    const march = points[points.length - 1];
    expect(march.won).toBe(1);
    expect(march.wonValue).toBe(1000);
    expect(march.created).toBe(1);
  });
});
