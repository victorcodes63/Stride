import { describe, expect, it } from 'vitest';
import {
  buildPayrollInvoiceLines,
  buildRecurringBillLines,
  computeServiceFeeExVat,
  parsePaymentTermsDays,
} from './billing-automation';

describe('billing-automation (RAV-75)', () => {
  it('parses Net payment terms', () => {
    expect(parsePaymentTermsDays('Net 15')).toBe(15);
    expect(parsePaymentTermsDays('due on receipt')).toBe(30);
  });

  it('computes per-employee service fee', () => {
    const fee = computeServiceFeeExVat(
      { serviceFeeType: 'per_employee', serviceFeeAmount: 2500, paymentTerms: null, currency: 'KES' },
      40,
    );
    expect(fee).toBe(100_000);
  });

  it('builds payroll invoice lines with pass-through and fee', () => {
    const lines = buildPayrollInvoiceLines({
      month: 4,
      year: 2026,
      headcount: 2,
      profile: {
        serviceFeeType: 'per_employee',
        serviceFeeAmount: 1000,
        paymentTerms: 'Net 30',
        currency: 'KES',
      },
      payrollRows: [
        { grossPay: 50000, netPay: 42000, nita: 50 },
        { grossPay: 60000, netPay: 50000, nita: 50 },
      ],
    });
    expect(lines[0]?.amountExVat).toBe(92000);
    expect(lines.some((l) => l.item.includes('NITA'))).toBe(true);
    expect(lines.some((l) => l.item.includes('management fee'))).toBe(true);
  });

  it('builds recurring headcount bill', () => {
    const lines = buildRecurringBillLines({
      month: 6,
      year: 2026,
      headcount: 10,
      profile: {
        serviceFeeType: 'per_employee',
        serviceFeeAmount: 500,
        paymentTerms: null,
        currency: 'KES',
      },
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.amountExVat).toBe(5000);
  });
});
