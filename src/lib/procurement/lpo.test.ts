import { describe, expect, it } from 'vitest';
import { lineTotal, nextLpoNumber } from '@/lib/procurement/lpo';

describe('procurement lpo helpers', () => {
  it('computes line totals with 2dp rounding', () => {
    expect(lineTotal(3, 10.005)).toBe(30.02);
    expect(lineTotal(2, 50)).toBe(100);
  });

  it('formats sequential LPO numbers', async () => {
    const db = {
      purchaseOrder: {
        count: async () => 5,
      },
    };
    expect(await nextLpoNumber(db as never, 'client-1')).toBe('LPO-0006');
  });
});
