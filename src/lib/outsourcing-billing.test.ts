import { describe, expect, it } from 'vitest';
import { buildRateCardInvoiceLines, mergeBillingLines } from '@/lib/outsourcing-billing';

describe('outsourcing-billing (OUT-07)', () => {
  it('builds per-head invoice lines from rate card', () => {
    const lines = buildRateCardInvoiceLines({
      month: 6,
      year: 2026,
      clientName: 'Text Book Centre',
      rateCard: {
        name: 'Standard',
        currency: 'KES',
        lines: [
          {
            label: 'Per employee / month',
            serviceKey: 'per_head',
            pricingModel: 'per_head',
            unitAmount: '3500',
            percentageBps: null,
          },
        ],
      },
      headcount: 40,
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]?.amountExVat).toBe(140_000);
    expect(lines[0]?.item).toContain('June 2026');
    expect(lines[0]?.description).toContain('40 headcount');
  });

  it('merges billing line groups and drops zero amounts', () => {
    const merged = mergeBillingLines(
      [{ item: 'A', description: 'x', amountExVat: 100 }],
      [{ item: 'B', description: 'y', amountExVat: 0 }],
      [{ item: 'C', description: 'z', amountExVat: 50 }],
    );
    expect(merged).toHaveLength(2);
    expect(merged.map((l) => l.item)).toEqual(['A', 'C']);
  });
});
