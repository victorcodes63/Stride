/**
 * KRA P9A — Tax Deduction Card (annual) aggregation for Kenyan payroll.
 *
 * Pure, Prisma-free module: it takes an employee's up-to-12 monthly Payroll rows
 * for one tax year and produces the standard P9A structure (12 month rows + an
 * annual totals row). Safe to import from server routes and (if needed) client
 * code — it has no server-only dependencies.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * P9A CELL → STORED Payroll FIELD MAPPING (documented precisely; see NOTES below)
 * ─────────────────────────────────────────────────────────────────────────────
 *  A  Basic Salary                    = Payroll.basicPay
 *  B  Benefits / Allowances (non-cash + cash allowances + any non-basic earnings)
 *                                      = Payroll.grossPay − Payroll.basicPay − C
 *                                        (captures the allowances JSON + leave pay
 *                                        + anything else rolled into gross)
 *  C  Value of Quarters               = 0 (no housing-benefit data is stored)
 *  D  Total Gross Pay                 = Payroll.grossPay          (authoritative)
 *  E  Defined Contribution Retirement Scheme — allowable deduction = min(E1,E2,E3)
 *       E1 = 30% of A (Basic)         (KRA statutory cap on pension relief)
 *       E2 = actual contribution      = Payroll.nssf   (NSSF is the recorded DC)
 *       E3 = fixed monthly cap        = 30,000 (KES 360,000 p.a.)
 *  F  Chargeable Pay                  = D − E − SHIF − AHL
 *                                        (mirrors payroll-calc taxableIncome:
 *                                         gross − nssf − shif − ahl)
 *  G  Tax Charged (PAYE before relief)= band tax computed on F (reconstructed;
 *                                        see NOTE 1)
 *  H  Personal Relief                 = monthly personal relief (2,400) for months
 *                                        that have payroll data
 *  J  PAYE Tax (after relief)         = Payroll.paye                (authoritative)
 *
 *  Deductions area carried alongside: NSSF (=E2), SHIF (=Payroll.nhif), AHL (=Payroll.ahl)
 *
 * NOTES / APPROXIMATIONS
 *  1. The stored `Payroll.paye` is PAYE AFTER personal relief. The P9A "Tax
 *     Charged" (G) is the gross band tax BEFORE relief. We reconstruct G by
 *     re-running the PAYE bands over F. Because payroll-calc uses the same bands,
 *     max(0, G − relief) reconciles to the stored `paye` (J). J stays
 *     authoritative; G is derived for presentation only.
 *  2. B is derived (gross − basic − quarters) rather than re-summed from the
 *     allowances JSON so the row stays internally consistent (A + B + C = D).
 *     `benefitsFromAllowancesJson` is also exposed for auditing.
 *  3. C (Value of Quarters) is always 0 — the schema stores no housing benefit.
 *  4. Insurance Relief and Owner-Occupier Interest are not modelled (no stored
 *     data); they are treated as 0 and omitted from the card.
 */

import {
  DEFAULT_KENYA_STATUTORY_RATES,
  type KenyaStatutoryRates,
} from '@/lib/country-config/constants';

/** 30% of basic — statutory cap on the pension (defined-contribution) deduction. */
export const P9_PENSION_RATE_OF_BASIC = 0.3;
/** Fixed monthly cap on the defined-contribution retirement deduction (KES). */
export const P9_PENSION_MONTHLY_CAP = 30_000;

export const P9_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Numeric-ish value as it may arrive from Prisma Decimals, strings, or numbers. */
type Numeric = number | string | { toString(): string } | null | undefined;

/** Minimal shape of a stored Payroll row needed to build a P9A card. */
export interface P9PayrollInput {
  month: number; // 1-12
  basicPay: Numeric;
  allowances?: Array<{ name: string; amount: Numeric }> | unknown;
  grossPay: Numeric;
  leavePay?: Numeric;
  paye: Numeric;
  nssf: Numeric;
  /** SHIF (stored on the legacy `nhif` field). */
  nhif: Numeric;
  ahl: Numeric;
}

export interface P9CardMeta {
  employerName: string;
  employerPin: string | null;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  employeePin: string | null;
  year: number;
  /** Optional override of statutory rates (bands + personal relief). */
  rates?: KenyaStatutoryRates;
}

export interface P9MonthRow {
  month: number; // 1-12
  monthName: string;
  hasData: boolean;
  basicSalary: number; // A
  benefits: number; // B
  benefitsFromAllowancesJson: number; // audit reference (sum of allowances JSON)
  valueOfQuarters: number; // C
  totalGrossPay: number; // D
  e1ThirtyPercentOfBasic: number; // E1
  e2ActualContribution: number; // E2 (NSSF)
  e3FixedCap: number; // E3
  definedContribution: number; // E = min(E1,E2,E3)
  chargeablePay: number; // F
  taxCharged: number; // G (before relief)
  personalRelief: number; // H
  payeTax: number; // J (after relief, stored)
  nssf: number;
  shif: number;
  ahl: number;
}

export type P9Totals = Omit<P9MonthRow, 'month' | 'monthName' | 'hasData'>;

export interface P9Card {
  meta: P9CardMeta;
  year: number;
  rows: P9MonthRow[]; // always 12, ordered Jan..Dec
  totals: P9Totals;
}

/** Lightweight per-employee summary for list views (JSON API). */
export interface P9Summary {
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  annualGross: number;
  annualPaye: number;
  monthsWithData: number;
}

/** Payroll Decimals -> Number(String(x)); tolerant of null/undefined. */
function toNum(v: Numeric): number {
  if (v == null) return 0;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sumAllowances(allowances: P9PayrollInput['allowances']): number {
  if (!Array.isArray(allowances)) return 0;
  return allowances.reduce((acc, a) => {
    const amount = a && typeof a === 'object' ? (a as { amount?: Numeric }).amount : 0;
    return acc + toNum(amount);
  }, 0);
}

/** Gross band tax (PAYE before personal relief) for a chargeable-pay amount. */
export function computeTaxCharged(
  chargeablePay: number,
  rates: KenyaStatutoryRates = DEFAULT_KENYA_STATUTORY_RATES,
): number {
  const taxable = Math.max(0, chargeablePay);
  let tax = 0;
  let remaining = taxable;
  let prevMax = 0;
  for (const band of rates.payeBands) {
    if (remaining <= 0) break;
    const width = Math.min(remaining, band.max - prevMax);
    if (width > 0) tax += width * band.rate;
    remaining -= width;
    prevMax = band.max;
  }
  return round2(tax);
}

function emptyRow(month: number): P9MonthRow {
  return {
    month,
    monthName: P9_MONTH_NAMES[month - 1] ?? String(month),
    hasData: false,
    basicSalary: 0,
    benefits: 0,
    benefitsFromAllowancesJson: 0,
    valueOfQuarters: 0,
    totalGrossPay: 0,
    e1ThirtyPercentOfBasic: 0,
    e2ActualContribution: 0,
    e3FixedCap: P9_PENSION_MONTHLY_CAP,
    definedContribution: 0,
    chargeablePay: 0,
    taxCharged: 0,
    personalRelief: 0,
    payeTax: 0,
    nssf: 0,
    shif: 0,
    ahl: 0,
  };
}

function buildRow(month: number, p: P9PayrollInput, rates: KenyaStatutoryRates): P9MonthRow {
  const basic = toNum(p.basicPay);
  const gross = toNum(p.grossPay);
  const nssf = toNum(p.nssf);
  const shif = toNum(p.nhif);
  const ahl = toNum(p.ahl);
  const paye = toNum(p.paye);
  const quarters = 0;

  // B derived so that A + B + C = D (see NOTE 2); JSON sum kept for auditing.
  const benefits = round2(Math.max(0, gross - basic - quarters));
  const benefitsFromJson = round2(sumAllowances(p.allowances) + toNum(p.leavePay));

  const e1 = round2(basic * P9_PENSION_RATE_OF_BASIC);
  const e2 = round2(nssf);
  const e3 = P9_PENSION_MONTHLY_CAP;
  const definedContribution = round2(Math.min(e1, e2, e3));

  const chargeablePay = round2(Math.max(0, gross - definedContribution - shif - ahl));
  const taxCharged = computeTaxCharged(chargeablePay, rates);
  const personalRelief = rates.personalRelief;

  return {
    month,
    monthName: P9_MONTH_NAMES[month - 1] ?? String(month),
    hasData: true,
    basicSalary: round2(basic),
    benefits,
    benefitsFromAllowancesJson: benefitsFromJson,
    valueOfQuarters: quarters,
    totalGrossPay: round2(gross),
    e1ThirtyPercentOfBasic: e1,
    e2ActualContribution: e2,
    e3FixedCap: e3,
    definedContribution,
    chargeablePay,
    taxCharged,
    personalRelief,
    payeTax: round2(paye),
    nssf: round2(nssf),
    shif: round2(shif),
    ahl: round2(ahl),
  };
}

/**
 * Aggregate an employee's monthly payroll rows into a P9A card for one tax year.
 * Missing months are emitted as zero rows so the card always has 12 entries.
 */
export function buildP9Card(monthlyPayrolls: P9PayrollInput[], meta: P9CardMeta): P9Card {
  const rates = meta.rates ?? DEFAULT_KENYA_STATUTORY_RATES;

  // Keep the last row per month if duplicates somehow arrive (unique constraint
  // makes this unlikely, but be defensive).
  const byMonth = new Map<number, P9PayrollInput>();
  for (const p of monthlyPayrolls) {
    if (p.month >= 1 && p.month <= 12) byMonth.set(p.month, p);
  }

  const rows: P9MonthRow[] = [];
  for (let m = 1; m <= 12; m++) {
    const p = byMonth.get(m);
    rows.push(p ? buildRow(m, p, rates) : emptyRow(m));
  }

  const totals: P9Totals = {
    basicSalary: 0,
    benefits: 0,
    benefitsFromAllowancesJson: 0,
    valueOfQuarters: 0,
    totalGrossPay: 0,
    e1ThirtyPercentOfBasic: 0,
    e2ActualContribution: 0,
    e3FixedCap: 0,
    definedContribution: 0,
    chargeablePay: 0,
    taxCharged: 0,
    personalRelief: 0,
    payeTax: 0,
    nssf: 0,
    shif: 0,
    ahl: 0,
  };
  for (const r of rows) {
    totals.basicSalary += r.basicSalary;
    totals.benefits += r.benefits;
    totals.benefitsFromAllowancesJson += r.benefitsFromAllowancesJson;
    totals.valueOfQuarters += r.valueOfQuarters;
    totals.totalGrossPay += r.totalGrossPay;
    totals.e1ThirtyPercentOfBasic += r.e1ThirtyPercentOfBasic;
    totals.e2ActualContribution += r.e2ActualContribution;
    totals.e3FixedCap += r.e3FixedCap;
    totals.definedContribution += r.definedContribution;
    totals.chargeablePay += r.chargeablePay;
    totals.taxCharged += r.taxCharged;
    totals.personalRelief += r.personalRelief;
    totals.payeTax += r.payeTax;
    totals.nssf += r.nssf;
    totals.shif += r.shif;
    totals.ahl += r.ahl;
  }
  (Object.keys(totals) as Array<keyof P9Totals>).forEach((k) => {
    totals[k] = round2(totals[k]);
  });

  return { meta: { ...meta, rates }, year: meta.year, rows, totals };
}

/** Build a lightweight summary from monthly payroll rows (for list views). */
export function summarizeP9(
  monthlyPayrolls: P9PayrollInput[],
  employee: { employeeId: string; employeeName: string; employeeNumber: string | null },
): P9Summary {
  let annualGross = 0;
  let annualPaye = 0;
  let monthsWithData = 0;
  for (const p of monthlyPayrolls) {
    annualGross += toNum(p.grossPay);
    annualPaye += toNum(p.paye);
    monthsWithData += 1;
  }
  return {
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    employeeNumber: employee.employeeNumber,
    annualGross: round2(annualGross),
    annualPaye: round2(annualPaye),
    monthsWithData,
  };
}
