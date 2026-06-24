/**
 * Kenyan payroll statutory calculations — driven by country_config (RAV-65).
 * Leave pay modes (per client):
 * - none: single gross; all statutories on that gross.
 * - paye_only: NSSF, SHIF, AHL on employment gross only; PAYE on gross+leave.
 * - included_in_gross: employment + leave pay as one gross.
 */
import {
  DEFAULT_KENYA_STATUTORY_RATES,
  type KenyaStatutoryRates,
} from '@/lib/country-config';

export type { KenyaStatutoryRates };
export {
  DEFAULT_KENYA_STATUTORY_RATES,
  getStatutoryRates,
  getPayrollStatutoryRates,
  getPayrollStatutoryRatesByClient,
  resolvePayrollCountry,
} from '@/lib/country-config';

/** @deprecated Use rates from getStatutoryRates() — kept for UI default display. */
export const NITA_LEVY_PER_EMPLOYEE_KES = DEFAULT_KENYA_STATUTORY_RATES.nitaPerEmployee;

/** PAYE stored/displayed to exactly 2 decimal places */
function roundPaye2(n: number): number {
  return Math.max(0, Math.round((n + Number.EPSILON) * 100) / 100);
}

function calcNSSF(grossPay: number, rates: KenyaStatutoryRates): number {
  const pensionable = Math.min(grossPay, rates.nssfTier2Limit);
  const tierI = Math.min(pensionable, rates.nssfTier1Limit) * rates.nssfRate;
  const tierII =
    Math.max(0, Math.min(pensionable - rates.nssfTier1Limit, rates.nssfTier2Limit - rates.nssfTier1Limit)) *
    rates.nssfRate;
  return Math.round(tierI + tierII);
}

function calcSHIF(grossPay: number, rates: KenyaStatutoryRates): number {
  return Math.round(grossPay * rates.shifRate);
}

function calcAHL(grossPay: number, rates: KenyaStatutoryRates): number {
  return Math.round(grossPay * rates.ahlRate);
}

function calcPAYE(
  grossPay: number,
  nssf: number,
  shif: number,
  ahl: number,
  rates: KenyaStatutoryRates,
): number {
  const taxableIncome = Math.max(0, grossPay - nssf - shif - ahl);
  let paye = 0;
  let remaining = taxableIncome;
  let prevMax = 0;

  for (const bracket of rates.payeBands) {
    if (remaining <= 0) break;
    const band = Math.min(remaining, bracket.max - prevMax);
    if (band > 0) paye += band * bracket.rate;
    remaining -= band;
    prevMax = bracket.max;
  }

  return roundPaye2(paye - rates.personalRelief);
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
  otherDeductionsTotal: number = 0,
  rates: KenyaStatutoryRates = DEFAULT_KENYA_STATUTORY_RATES,
): StatutoryResult {
  const lp = Math.max(0, leavePay);
  const mode = (leavePayMode || 'none') as LeavePayMode;

  if (mode === 'paye_only') {
    const nssf = calcNSSF(employmentGross, rates);
    const shif = calcSHIF(employmentGross, rates);
    const ahl = calcAHL(employmentGross, rates);
    const payeGross = employmentGross + lp;
    const paye = calcPAYE(payeGross, nssf, shif, ahl, rates);
    const netPay = employmentGross - paye - nssf - shif - ahl - otherDeductionsTotal + lp;
    return {
      grossPay: employmentGross + lp,
      paye,
      nssf,
      nhif: shif,
      ahl,
      nita: rates.nitaPerEmployee,
      netPay,
      employmentGross,
      leavePay: lp,
    };
  }

  const totalGross =
    mode === 'included_in_gross' && lp > 0 ? employmentGross + lp : employmentGross;
  const nssf = calcNSSF(totalGross, rates);
  const shif = calcSHIF(totalGross, rates);
  const ahl = calcAHL(totalGross, rates);
  const paye = calcPAYE(totalGross, nssf, shif, ahl, rates);
  const netPay = totalGross - paye - nssf - shif - ahl - otherDeductionsTotal;
  return {
    grossPay: totalGross,
    paye,
    nssf,
    nhif: shif,
    ahl,
    nita: rates.nitaPerEmployee,
    netPay,
    employmentGross,
    leavePay: mode === 'included_in_gross' ? lp : 0,
  };
}

export function calculateStatutory(
  grossPay: number,
  otherDeductionsTotal: number = 0,
  rates: KenyaStatutoryRates = DEFAULT_KENYA_STATUTORY_RATES,
): StatutoryResult {
  return calculateStatutoryForPayroll('none', grossPay, 0, otherDeductionsTotal, rates);
}
