import { describe, expect, it } from 'vitest';
import {
  invoiceLineDraftsToAmounts,
  invoiceLineDraftsToPayload,
  lineTotalExVat,
  parseInvoiceLineQuantity,
} from './accounts-invoice-line-draft';

describe('accounts-invoice-line-draft', () => {
  it('multiplies unit price by quantity for line total', () => {
    expect(lineTotalExVat('18000', '4')).toBe(72_000);
  });

  it('defaults empty quantity to 1', () => {
    expect(parseInvoiceLineQuantity('')).toBe(1);
    expect(parseInvoiceLineQuantity('   ')).toBe(1);
    expect(lineTotalExVat('18000', '')).toBe(18_000);
  });

  it('defaults invalid quantity to 1', () => {
    expect(parseInvoiceLineQuantity('-2')).toBe(1);
    expect(lineTotalExVat('18000', '')).toBe(18_000);
  });

  it('builds preview amounts from drafts', () => {
    const amounts = invoiceLineDraftsToAmounts([
      { amountExVat: '18000', quantity: '4' },
      { amountExVat: '500', quantity: '2' },
    ]);
    expect(amounts).toEqual([{ amountExVat: 72_000 }, { amountExVat: 1000 }]);
  });

  it('builds API payload with line totals', () => {
    const payload = invoiceLineDraftsToPayload([
      { item: 'PACIDA PSYCHOMETRICS', amountExVat: '18000', quantity: '4', description: 'Internal' },
    ]);
    expect(payload).toEqual([
      { item: 'PACIDA PSYCHOMETRICS', amountExVat: 72_000, description: 'Internal' },
    ]);
  });
});
