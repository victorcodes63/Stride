import { describe, expect, it } from 'vitest';
import { buildClientStatement, computeAgeingBuckets } from './statements';

describe('accounts statements (RAV-74)', () => {
  it('computes ageing buckets from due dates', () => {
    const asOf = new Date('2026-06-25T12:00:00.000Z');
    const ageing = computeAgeingBuckets(
      [
        { dueDate: new Date('2026-07-01'), issueDate: new Date('2026-06-01'), outstanding: 1000 },
        { dueDate: new Date('2026-06-10'), issueDate: new Date('2026-05-01'), outstanding: 500 },
        { dueDate: new Date('2026-03-01'), issueDate: new Date('2026-02-01'), outstanding: 200 },
      ],
      asOf,
    );
    expect(ageing.current).toBe(1000);
    expect(ageing.days1_30).toBe(500);
    expect(ageing.over90).toBe(200);
    expect(ageing.total).toBe(1700);
  });

  it('builds client statement with ageing from invoices and payments', () => {
    const statement = buildClientStatement({
      id: 'c1',
      name: 'Acme Ltd',
      type: 'outsourcing',
      currency: 'KES',
      contactEmail: 'billing@acme.test',
      invoices: [
        {
          issueDate: new Date('2026-05-01'),
          dueDate: new Date('2026-05-31'),
          invoiceNumber: 12,
          lines: [{ amountExVat: 10000 }],
          vatRateBps: 0,
          totalOverrideIncVat: null,
          allocations: [{ amount: 4000 }],
          creditNotes: [],
        },
      ],
      clientPayments: [
        { receivedAt: new Date('2026-05-15'), amount: 4000, reference: 'MPESA-1', method: 'M-Pesa' },
      ],
    });

    expect(statement.summary.closingBalance).toBe(6000);
    expect(statement.ageing.total).toBe(6000);
    expect(statement.entries).toHaveLength(2);
  });
});
