import { describe, expect, it } from 'vitest';
import { calculateStatutoryForPayroll } from '@/lib/payroll-calc';
import { DEFAULT_KENYA_STATUTORY_RATES } from '@/lib/country-config';

const R = DEFAULT_KENYA_STATUTORY_RATES;

/**
 * Hand-checked against Finance Act 2025 PAYE bands + 2026 statutory guides
 * (SHIF 2.75%, AHL 1.5%, NSSF 6% two-tier, personal relief 2,400, NITA 50).
 */
describe('Kenya payroll statutory golden cases (RAV-129)', () => {
  function statutory(gross: number) {
    return calculateStatutoryForPayroll('none', gross, 0, 0, R);
  }

  it('NSSF Tier I + II caps at 6,480 for high earners', () => {
    expect(statutory(200_000).nssf).toBe(6_480);
    expect(statutory(108_000).nssf).toBe(6_480);
  });

  it('NSSF Tier I only below Tier II threshold', () => {
    // gross 8,000 → 6% × 8,000 = 480 (Tier I limit per Feb 2026 guides uses 8k; code uses 9k → 540)
    const at8k = statutory(8_000);
    expect(at8k.nssf).toBe(480); // 6% × 8,000 — within Tier I when tier1 limit is 9,000
  });

  it('SHIF is 2.75% of gross (rounded)', () => {
    expect(statutory(50_000).nhif).toBe(Math.round(50_000 * R.shifRate));
    expect(statutory(100_000).nhif).toBe(2_750);
  });

  it('AHL is 1.5% of gross (rounded)', () => {
    expect(statutory(100_000).ahl).toBe(1_500);
  });

  it('NITA employer levy is flat 50 — not deducted from net', () => {
    const r = statutory(62_000);
    expect(r.nita).toBe(50);
    expect(r.netPay).toBe(r.grossPay - r.paye - r.nssf - r.nhif - r.ahl);
  });

  it('PAYE at KES 50,000 gross (published walkthrough)', () => {
    const gross = 50_000;
    const r = statutory(gross);
    expect(r.nssf).toBe(3_000);
    expect(r.nhif).toBe(1_375);
    expect(r.ahl).toBe(750);
    // taxable = 50000 - 3000 - 1375 - 750 = 44875
    // gross tax: 2400 + 2083.25 + 3762.6 = 8245.85 → PAYE 5845.85 after relief
    expect(r.paye).toBe(5_845.85);
    expect(r.netPay).toBe(39_029.15);
  });

  it('PAYE at KES 100,000 gross (published walkthrough)', () => {
    const gross = 100_000;
    const r = statutory(gross);
    expect(r.nssf).toBe(6_000);
    expect(r.nhif).toBe(2_750);
    expect(r.ahl).toBe(1_500);
    // taxable = 89750 → PAYE ≈ 19308.35 per band math
    expect(r.paye).toBe(19_308.35);
    expect(r.netPay).toBe(70_441.65);
  });

  it('zero PAYE when taxable income yields tax below personal relief', () => {
    const r = statutory(15_000);
    expect(r.paye).toBe(0);
  });

  it('paye_only mode: NSSF/SHIF/AHL on employment gross only', () => {
    const employment = 80_000;
    const leave = 10_000;
    const r = calculateStatutoryForPayroll('paye_only', employment, leave, 0, R);
    const empOnly = calculateStatutoryForPayroll('none', employment, 0, 0, R);
    expect(r.nssf).toBe(empOnly.nssf);
    expect(r.nhif).toBe(empOnly.nhif);
    expect(r.ahl).toBe(empOnly.ahl);
    expect(r.grossPay).toBe(90_000);
    expect(r.paye).toBeGreaterThan(empOnly.paye);
  });
});
