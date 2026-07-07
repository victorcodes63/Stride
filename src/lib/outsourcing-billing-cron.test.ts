import { describe, expect, it, vi } from 'vitest';
import { runOutsourcingMonthlyBilling } from '@/lib/outsourcing-billing-cron';

describe('outsourcing billing cron (OUT-07)', () => {
  it('skips clients that already have an invoice for the period', async () => {
    const tx = {
      outsourcingClient: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'client-1', organizationId: 'org-1', name: 'Acme Ltd' },
        ]),
      },
      accountsInvoice: {
        findFirst: vi.fn().mockResolvedValue({ id: 'inv-existing' }),
      },
    };

    const result = await runOutsourcingMonthlyBilling(tx as never, { month: 6, year: 2026 });

    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});
