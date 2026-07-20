import { describe, expect, it } from 'vitest';

import { ratingFromScore, scoreLead } from '@/lib/sales/lead-scoring';

const now = new Date('2026-02-01T12:00:00.000Z');

describe('ratingFromScore', () => {
  it('bands scores into hot/warm/cold', () => {
    expect(ratingFromScore(85)).toBe('hot');
    expect(ratingFromScore(70)).toBe('hot');
    expect(ratingFromScore(55)).toBe('warm');
    expect(ratingFromScore(40)).toBe('warm');
    expect(ratingFromScore(20)).toBe('cold');
  });
});

describe('scoreLead', () => {
  it('scores a complete, high-value, fresh, referral lead as hot', () => {
    const res = scoreLead(
      {
        email: 'a@b.com',
        phone: '+254700000000',
        company: 'Acme Ltd',
        source: 'Referral',
        estimatedValue: 5_000_000,
        lastActivityAt: '2026-01-31T12:00:00.000Z',
      },
      now,
    );
    expect(res.score).toBeGreaterThanOrEqual(70);
    expect(res.rating).toBe('hot');
    expect(res.breakdown).toHaveLength(6);
    expect(res.breakdown.reduce((s, b) => s + b.max, 0)).toBe(100);
  });

  it('scores a sparse, stale, cold-call lead as cold', () => {
    const res = scoreLead(
      { source: 'Cold call', createdAt: '2025-10-01T12:00:00.000Z' },
      now,
    );
    expect(res.rating).toBe('cold');
    expect(res.score).toBeLessThan(40);
  });

  it('floors disqualified leads and maxes converted leads', () => {
    const base = { email: 'a@b.com', phone: '+254700000000', company: 'Acme', source: 'Referral', estimatedValue: 5_000_000, lastActivityAt: '2026-01-31T12:00:00.000Z' };
    expect(scoreLead({ ...base, status: 'disqualified' }, now).score).toBeLessThanOrEqual(10);
    expect(scoreLead({ ...base, status: 'converted' }, now).score).toBe(100);
  });

  it('keeps scores within 0-100', () => {
    const res = scoreLead({ email: 'a@b.com', estimatedValue: 999_999_999, lastActivityAt: now.toISOString() }, now);
    expect(res.score).toBeGreaterThanOrEqual(0);
    expect(res.score).toBeLessThanOrEqual(100);
  });
});
