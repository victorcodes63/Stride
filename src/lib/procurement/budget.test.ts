import { describe, expect, it } from 'vitest';
import { checkBudgetForRequest, computeAvailable } from '@/lib/procurement/budget';

type Item = { allocatedAmount: number; spentAmount: number; committedAmount: number };

function mockTx(items: Record<string, Item>) {
  return {
    budgetLineItem: {
      findFirst: async ({ where }: { where: { id: string } }) => items[where.id] ?? null,
    },
  } as never;
}

const ctx = { organizationId: 'org-1' };

describe('procurement budget helpers', () => {
  it('computes available = allocated - spent - committed with 2dp rounding', () => {
    expect(computeAvailable(1000, 200, 300)).toBe(500);
    expect(computeAvailable(100.005, 0, 0)).toBe(100.01);
  });

  it('passes when aggregated request lines fit remaining availability', async () => {
    const tx = mockTx({ 'bli-1': { allocatedAmount: 1000, spentAmount: 200, committedAmount: 100 } });
    const result = await checkBudgetForRequest(tx, ctx, [
      { budgetLineItemId: 'bli-1', amount: 300 },
      { budgetLineItemId: 'bli-1', amount: 400 },
    ]);
    expect(result.ok).toBe(true);
    expect(result.breaches).toHaveLength(0);
  });

  it('reports a breach when the aggregated request exceeds availability', async () => {
    const tx = mockTx({ 'bli-1': { allocatedAmount: 1000, spentAmount: 200, committedAmount: 100 } });
    const result = await checkBudgetForRequest(tx, ctx, [
      { budgetLineItemId: 'bli-1', amount: 500 },
      { budgetLineItemId: 'bli-1', amount: 400 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.breaches).toEqual([{ budgetLineItemId: 'bli-1', requested: 900, available: 700 }]);
  });

  it('ignores lines without a budgetLineItemId and treats missing budgets as zero availability', async () => {
    const tx = mockTx({});
    const result = await checkBudgetForRequest(tx, ctx, [
      { budgetLineItemId: null, amount: 999999 },
      { budgetLineItemId: 'missing', amount: 1 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.breaches).toEqual([{ budgetLineItemId: 'missing', requested: 1, available: 0 }]);
  });
});
