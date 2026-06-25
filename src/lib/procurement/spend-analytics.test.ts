import { describe, expect, it } from 'vitest';
import { sumMonthlyOrdered } from '@/lib/procurement/spend-analytics';

describe('procurement spend analytics', () => {
  it('sums monthly ordered LPO amounts by issuedAt month', () => {
    const months = sumMonthlyOrdered(
      [
        { issuedAt: new Date('2026-03-15'), totalAmount: 1000, status: 'issued' },
        { issuedAt: new Date('2026-03-20'), totalAmount: 500, status: 'fulfilled' },
        { issuedAt: new Date('2026-04-01'), totalAmount: 200, status: 'issued' },
        { issuedAt: new Date('2026-03-01'), totalAmount: 999, status: 'draft' },
        { issuedAt: new Date('2025-03-01'), totalAmount: 50, status: 'issued' },
      ],
      2026,
    );
    expect(months[2]).toBe(1500);
    expect(months[3]).toBe(200);
    expect(months[0]).toBe(0);
  });
});
