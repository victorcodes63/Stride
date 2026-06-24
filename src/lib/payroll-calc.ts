/**
 * Kenyan payroll statutory calculations (2024/2026).
 * Leave pay modes (per client):
 * - none: single gross; all statutories on that gross.
 * - paye_only (Client X): NSSF, SHIF, AHL always on employment gross only (basic + allowances, never leave pay).
 *   PAYE uses (employment + leave pay) as gross for brackets, minus those NSSF/SHIF/AHL. Net = employment − deductions + leave pay.
 * - included_in_gross (Client Y): employment + leave pay as one gross; all statutories on that total.
 */

const PAYE_BRACKETS = [
  { max: 24_000, rate: 0.1 },
  { max: 32_333, rate: 0.25 },
  { max: 500_000, rate: 0.3 },
  { max: 800_000, rate: 0.325 },
  { max: Infinity, rate: 0.35 },
];
const PERSONAL_RELIEF = 2_400;

/** Kenya NITA employer levy: flat per employee per month (not taken from net pay). */
export const NITA_LEVY_PER_EMPLOYEE_KES = 50;

/** PAYE stored/displayed to exactly 2 decimal places */
function roundPaye2(n: number): number {
  return Math.max(0, Math.round((n + Number.EPSILON) * 100) / 100);
}

function calcNSSF(grossPay: number): number {
  const pensionable = Math.min(grossPay, 108_000);
  const tierI = Math.min(pensionable, 9_000) * 0.06;
  const tierII = Math.max(0, Math.min(pensionable - 9_000, 99_000)) * 0.06;
  return Math.round(tierI + tierII);
}

function calcSHIF(grossPay: number): number {
  return Math.round(grossPay * 0.0275);
}

function calcAHL(grossPay: number): number {
  return Math.round(grossPay * 0.015);
}

function calcPAYE(grossPay: number, nssf: number, shif: number, ahl: number): number {
  const taxableIncome = Math.max(0, grossPay - nssf - shif - ahl);
  let paye = 0;
  let remaining = taxableIncome;
  let prevMax = 0;

  for (const bracket of PAYE_BRACKETS) {
    if (remaining <= 0) break;
    const band = Math.min(remaining, bracket.max - prevMax);
    if (band > 0) paye += band * bracket.rate;
    remaining -= band;
    prevMax = bracket.max;
  }

  return roundPaye2(paye - PERSONAL_RELIEF);
}

export type LeavePayMode = 'none' | 'paye_only' | 'included_in_gross';

export interface StatutoryResult {
  grossPay: number;
  paye: number;
  nssf: number;
  nhif: number;
  ahl: number;
  /** Employer NITA levy per employee per month; does not reduce netPay. */
  nita: number;
  netPay: number;
  employmentGross?: number;
  leavePay?: number;
}

/**
 * employmentGross = basic + allowances (excludes leave pay when mode is paye_only)
 * leavePay = leave pay amount (0 if none)
 */
export function calculateStatutoryForPayroll(
  leavePayMode: LeavePayMode | string | null | undefined,
  employmentGross: number,
  leavePay: number,
  otherDeductionsTotal: number = 0
): StatutoryResult {
  const lp = Math.max(0, leavePay);
  const mode = (leavePayMode || 'none') as LeavePayMode;

  // Client X: NSSF/SHIF/AHL only on employment gross (exclude leave pay from that base).
  if (mode === 'paye_only') {
    const nssf = calcNSSF(employmentGross);
    const shif = calcSHIF(employmentGross);
    const ahl = calcAHL(employmentGross);
    const payeGross = employmentGross + lp;
    const paye = calcPAYE(payeGross, nssf, shif, ahl);
    const netPay = employmentGross - paye - nssf - shif - ahl - otherDeductionsTotal + lp;
    return {
      grossPay: employmentGross + lp,
      paye,
      nssf,
      nhif: shif,
      ahl,
      nita: NITA_LEVY_PER_EMPLOYEE_KES,
      netPay,
      employmentGross,
      leavePay: lp,
    };
  }

  const totalGross =
    mode === 'included_in_gross' && lp > 0 ? employmentGross + lp : employmentGross;
  const nssf = calcNSSF(totalGross);
  const shif = calcSHIF(totalGross);
  const ahl = calcAHL(totalGross);
  const paye = calcPAYE(totalGross, nssf, shif, ahl);
  const netPay = totalGross - paye - nssf - shif - ahl - otherDeductionsTotal;
  return {
    grossPay: totalGross,
    paye,
    nssf,
    nhif: shif,
    ahl,
    nita: NITA_LEVY_PER_EMPLOYEE_KES,
    netPay,
    employmentGross,
    leavePay: mode === 'included_in_gross' ? lp : 0,
  };
}

export function calculateStatutory(
  grossPay: number,
  otherDeductionsTotal: number = 0
): StatutoryResult {
  return calculateStatutoryForPayroll('none', grossPay, 0, otherDeductionsTotal);
}
