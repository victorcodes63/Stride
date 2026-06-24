import { describe, expect, it } from 'vitest';
import { calculateStatutoryForPayroll } from '@/lib/payroll-calc';
import {
  DEFAULT_KENYA_STATUTORY_RATES,
  UGANDA_STATUTORY_STUB,
  resolvePayrollCountry,
} from '@/lib/country-config';

describe('country-config', () => {
  it('resolves entity code to country', () => {
    expect(resolvePayrollCountry({ entityCode: 'ug', organizationCountry: 'KE' })).toBe('UG');
    expect(resolvePayrollCountry({ organizationCountry: 'ke' })).toBe('KE');
  });

  it('Kenya statutory math matches config-driven rates', () => {
    const gross = 100_000;
    const result = calculateStatutoryForPayroll('none', gross, 0, 0, DEFAULT_KENYA_STATUTORY_RATES);
    expect(result.nssf).toBe(6_000);
    expect(result.nhif).toBe(Math.round(gross * 0.0275));
    expect(result.ahl).toBe(Math.round(gross * 0.015));
    expect(result.nita).toBe(50);
  });

  it('UG stub produces zero statutory deductions until pack is filled', () => {
    const result = calculateStatutoryForPayroll('none', 50_000, 0, 0, UGANDA_STATUTORY_STUB);
    expect(result.paye).toBe(0);
    expect(result.nssf).toBe(0);
    expect(result.netPay).toBe(50_000);
  });
});
