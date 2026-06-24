/**
 * Bi-weekly payroll: statutory is computed on **combined monthly gross** (Kenya monthly PAYE/NSSF/SHIF/AHL).
 * Each period payslip shows that period's gross and a **proportional share** of monthly statutory
 * so period1_net + period2_net ≈ monthly_net (rounding on period 2).
 */

export type StatutoryBreakdown = {
  paye: number;
  nssf: number;
  shif: number;
  ahl: number;
};

export type PeriodAllocation = {
  period: 1 | 2;
  gross: number;
  paye: number;
  nssf: number;
  shif: number;
  ahl: number;
  netBeforeOther: number;
};

/**
 * Split monthly statutory across two periods by gross share.
 * Remainder from rounding applied to period 2 so totals match monthly.
 */
export function allocateStatutoryBiweekly(
  g1: number,
  g2: number,
  monthly: StatutoryBreakdown
): { period1: PeriodAllocation; period2: PeriodAllocation; monthlyNet: number } {
  const totalG = g1 + g2;
  if (totalG <= 0) {
    return {
      period1: { period: 1, gross: g1, paye: 0, nssf: 0, shif: 0, ahl: 0, netBeforeOther: 0 },
      period2: { period: 2, gross: g2, paye: 0, nssf: 0, shif: 0, ahl: 0, netBeforeOther: 0 },
      monthlyNet: 0,
    };
  }
  const r1 = g1 / totalG;
  const r2 = g2 / totalG;

  const split = (total: number) => {
    const a = Math.round(total * r1);
    const b = total - a; // remainder to period 2 — exact sum
    return [a, b] as const;
  };

  /** PAYE only: 2 decimal places; period 2 = remainder so monthly total preserved */
  const payeTotal = Math.round(monthly.paye * 100) / 100;
  const paye1 = Math.round(payeTotal * r1 * 100) / 100;
  const paye2 = Math.round((payeTotal - paye1) * 100) / 100;
  const [nssf1, nssf2] = split(monthly.nssf);
  const [shif1, shif2] = split(monthly.shif);
  const [ahl1, ahl2] = split(monthly.ahl);

  const ded1 = paye1 + nssf1 + shif1 + ahl1;
  const ded2 = paye2 + nssf2 + shif2 + ahl2;
  const monthlyNet = totalG - payeTotal - monthly.nssf - monthly.shif - monthly.ahl;

  return {
    period1: {
      period: 1,
      gross: g1,
      paye: paye1,
      nssf: nssf1,
      shif: shif1,
      ahl: ahl1,
      netBeforeOther: g1 - ded1,
    },
    period2: {
      period: 2,
      gross: g2,
      paye: paye2,
      nssf: nssf2,
      shif: shif2,
      ahl: ahl2,
      netBeforeOther: g2 - ded2,
    },
    monthlyNet,
  };
}

export function isBiweeklyClient(frequency: string | null | undefined): boolean {
  return frequency === 'biweekly' || frequency === 'bi_weekly';
}
