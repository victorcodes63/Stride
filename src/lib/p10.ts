/**
 * KRA P10 — Simplified Unified Payroll Return (monthly PAYE return) builder.
 *
 * Pure, Prisma-free module. It takes one month's stored Payroll rows for an
 * employer and produces the three sections the KRA "Simplified Unified Payroll
 * Return" macro-workbook expects:
 *   • Section A  — Return Information (employer PIN, period, entity type)
 *   • Section B  — Details of Salary Paid and PAYE deducted per employee
 *   • Section E  — Calculation of Tax Due (totals)
 *
 * The primary deliverable is a Section B CSV whose columns match the template's
 * `B_Employees_Dtls_Simplified` sheet 1:1 (in on-screen order), so it can be
 * imported via the template's "Import CSV" action (or pasted straight into
 * Section B). The workbook re-computes the derived columns (Total Gross Pay,
 * Taxable Pay, PAYE Tax) on import; we fill them too so the CSV also stands
 * alone as an auditable artifact and reconciles with Section E.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SECTION B COLUMN → STORED FIELD MAPPING (template order A..Y, then HOSP)
 * ─────────────────────────────────────────────────────────────────────────────
 *  A  PIN of Employee                 = Employee.kraPin
 *  B  Name of Employee                = "First Last"
 *  C  Resident Status                 = "Resident"            (default; not stored)
 *  D  Type of Employee                = "Primary Employee"    (default; not stored)
 *  E  Persons With Disability (PWD)   = "No"                  (default; not stored)
 *  F  Exemption Certificate Number    = ""                    (only for PWD=Yes)
 *  G  Total Cash Pay (A)              = Payroll.grossPay      (all earnings are cash)
 *  H  Value of Car Benefit (B)        = 0
 *  I  Value of Meals (C)              = 0
 *  J  Non Cash Benefits (D)           = 0
 *  K  Type of Housing                 = "Benefit not given"
 *  L  Housing Benefit (F)             = 0
 *  M  Other Benefits (G)              = 0
 *  N  Total Gross Pay (H)=A+B+C+D+F+G = Payroll.grossPay      (derived; = G here)
 *  O  Social Health Insurance (SHIF)(I)= Payroll.nhif         (SHIF stored on nhif)
 *  P  NSSF Contribution (J)           = Payroll.nssf
 *  Q  Other Pension Contribution (K)  = 0
 *  R  Post Retirement Medical Fund(L) = 0
 *  S  Mortgage Interest (M)           = 0
 *  T  Affordable Housing Levy (N)     = Payroll.ahl
 *  U  Taxable Pay (O)                 = max(0, N − definedContribution − SHIF − AHL)
 *  V  Monthly Personal Relief (P)     = rates.personalRelief  (2,400)
 *  W  Amount of Insurance Relief (Q)  = 0
 *  X  PAYE Tax (R)=(O−P−Q)            = Payroll.paye          (authoritative)
 *  Y  Self Assessed PAYE Tax (S)      = Payroll.paye          (what was deducted)
 *  HOSP Deposit on Home Ownership Saving Plan (N) = 0
 *
 * definedContribution = min(30% × basic, NSSF, 30,000) — same cap payroll-calc /
 * P9A use, so U reconciles with the P9A chargeable pay.
 *
 * NOTES
 *  1. Resident status, employee type, PWD and exemption cert are not yet stored
 *     on Employee; sensible KRA defaults are emitted and can be overridden per
 *     employee later by threading `overrides` into buildP10Return.
 *  2. Section E "PAYE deducted from employees Without PIN" sums PAYE for rows
 *     whose employee has no KRA PIN (KRA taxes these at source and tracks them
 *     separately).
 *  3. NITA is an employer levy of KES 50 per contributing member per month.
 */

import {
  DEFAULT_KENYA_STATUTORY_RATES,
  type KenyaStatutoryRates,
} from '@/lib/country-config/constants';

/** 30% of basic — statutory cap on the pension (defined-contribution) deduction. */
export const P10_PENSION_RATE_OF_BASIC = 0.3;
/** Fixed monthly cap on the defined-contribution retirement deduction (KES). */
export const P10_PENSION_MONTHLY_CAP = 30_000;
/** NITA employer levy per contributing member per month (KES). */
export const P10_NITA_PER_MEMBER = 50;

/** KRA-exact enum strings (from the template's hidden Data sheet). */
export const P10_RESIDENT_STATUS = { resident: 'Resident', nonResident: 'Non-Resident' } as const;
export const P10_EMPLOYEE_TYPE = { primary: 'Primary Employee', secondary: 'Secondary Employee' } as const;
export const P10_PWD = { yes: 'Yes', no: 'No' } as const;
export const P10_HOUSING_NONE = 'Benefit not given';
export const P10_RETURN_TYPE_ORIGINAL = 'Original';
export const P10_ENTITY_HEAD_OFFICE = 'Head Office';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Numeric-ish value as it may arrive from Prisma Decimals, strings, or numbers. */
type Numeric = number | string | { toString(): string } | null | undefined;

/** Minimal shape of a stored Payroll row (+ employee) needed for a P10 Section B row. */
export interface P10PayrollInput {
  employeeId: string;
  employeeName: string;
  employeePin: string | null;
  basicPay: Numeric;
  grossPay: Numeric;
  paye: Numeric;
  nssf: Numeric;
  /** SHIF (stored on the legacy `nhif` field). */
  nhif: Numeric;
  ahl: Numeric;
  nita?: Numeric;
  /** Per-employee overrides for fields not stored on Employee yet. */
  residentStatus?: string;
  employeeType?: string;
  pwd?: boolean;
  exemptionCertificateNumber?: string | null;
}

export interface P10Meta {
  employerName: string;
  employerPin: string | null;
  month: number; // 1-12
  year: number;
  returnType?: string; // default "Original"
  entityType?: string; // default "Head Office"
  rates?: KenyaStatutoryRates;
}

/** Section A — Return Information. */
export interface P10BasicInfo {
  employerPin: string | null;
  employerName: string;
  returnType: string;
  entityType: string;
  returnPeriodFrom: string; // dd/mm/yyyy
  returnPeriodTo: string; // dd/mm/yyyy
  month: number;
  monthName: string;
  year: number;
  hasLumpSumOrFbt: 'Yes' | 'No';
}

/** Section B — one employee row (all template columns, in order). */
export interface P10SectionBRow {
  pin: string; // A
  name: string; // B
  residentStatus: string; // C
  employeeType: string; // D
  pwd: string; // E (Yes/No)
  exemptionCertificateNumber: string; // F
  totalCashPay: number; // G (A)
  carBenefit: number; // H (B)
  meals: number; // I (C)
  nonCashBenefits: number; // J (D)
  typeOfHousing: string; // K
  housingBenefit: number; // L (F)
  otherBenefits: number; // M (G)
  totalGrossPay: number; // N (H)
  shif: number; // O (I)
  nssf: number; // P (J)
  otherPension: number; // Q (K)
  postRetirementMedical: number; // R (L)
  mortgageInterest: number; // S (M)
  affordableHousingLevy: number; // T (N)
  taxablePay: number; // U (O)
  personalRelief: number; // V (P)
  insuranceRelief: number; // W (Q)
  payeTax: number; // X (R)
  selfAssessedPaye: number; // Y (S)
  hosp: number; // HOSP (Deposit on Home Ownership Saving Plan)
  /** True when the employee has no KRA PIN (feeds Section E line 5). */
  hasNoPin: boolean;
}

/** Section E — Calculation of Tax Due. */
export interface P10TaxDue {
  totalEmployees: number; // 1
  payeFromEmployees: number; // 2  (Σ Self Assessed PAYE)
  payeOnLumpSum: number; // 3
  fringeBenefitTax: number; // 4
  payeFromEmployeesWithoutPin: number; // 5
  totalPayePayable: number; // 6 = 2+3+4+5
  totalHousingLevy: number; // 7  (Σ AHL)
  nitaMembers: number; // 8
  totalNitaContribution: number; // 9 = members × 50
  totalPayable: number; // 10 = 6+7+9
}

export interface P10Return {
  meta: P10Meta;
  basicInfo: P10BasicInfo;
  rows: P10SectionBRow[];
  taxDue: P10TaxDue;
}

function toNum(v: Numeric): number {
  if (v == null) return 0;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Last calendar day of a 1-based month/year. */
function lastDayOfMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function ddmmyyyy(day: number, month: number, year: number): string {
  return `${pad2(day)}/${pad2(month)}/${year}`;
}

function buildSectionBRow(p: P10PayrollInput, rates: KenyaStatutoryRates): P10SectionBRow {
  const basic = toNum(p.basicPay);
  const gross = toNum(p.grossPay);
  const shif = toNum(p.nhif);
  const nssf = toNum(p.nssf);
  const ahl = toNum(p.ahl);
  const paye = toNum(p.paye);

  const definedContribution = Math.min(basic * P10_PENSION_RATE_OF_BASIC, nssf, P10_PENSION_MONTHLY_CAP);
  const taxablePay = Math.max(0, gross - definedContribution - shif - ahl);

  const pin = (p.employeePin ?? '').trim();

  return {
    pin,
    name: p.employeeName,
    residentStatus: p.residentStatus?.trim() || P10_RESIDENT_STATUS.resident,
    employeeType: p.employeeType?.trim() || P10_EMPLOYEE_TYPE.primary,
    pwd: p.pwd ? P10_PWD.yes : P10_PWD.no,
    exemptionCertificateNumber: (p.exemptionCertificateNumber ?? '').trim(),
    totalCashPay: round2(gross),
    carBenefit: 0,
    meals: 0,
    nonCashBenefits: 0,
    typeOfHousing: P10_HOUSING_NONE,
    housingBenefit: 0,
    otherBenefits: 0,
    totalGrossPay: round2(gross),
    shif: round2(shif),
    nssf: round2(nssf),
    otherPension: 0,
    postRetirementMedical: 0,
    mortgageInterest: 0,
    affordableHousingLevy: round2(ahl),
    taxablePay: round2(taxablePay),
    personalRelief: rates.personalRelief,
    insuranceRelief: 0,
    payeTax: round2(paye),
    selfAssessedPaye: round2(paye),
    hosp: 0,
    hasNoPin: pin.length === 0,
  };
}

/**
 * Aggregate one month's payroll rows for an employer into a full P10 return
 * (Section A basic info + Section B rows + Section E tax-due totals).
 */
export function buildP10Return(payrolls: P10PayrollInput[], meta: P10Meta): P10Return {
  const rates = meta.rates ?? DEFAULT_KENYA_STATUTORY_RATES;
  const { month, year } = meta;

  const rows = payrolls
    .map((p) => buildSectionBRow(p, rates))
    .sort((a, b) => a.name.localeCompare(b.name));

  const payeFromEmployees = round2(rows.reduce((s, r) => s + r.selfAssessedPaye, 0));
  const payeFromEmployeesWithoutPin = round2(
    rows.reduce((s, r) => s + (r.hasNoPin ? r.selfAssessedPaye : 0), 0),
  );
  const totalHousingLevy = round2(rows.reduce((s, r) => s + r.affordableHousingLevy, 0));
  const nitaMembers = payrolls.reduce((s, p) => s + (toNum(p.nita) > 0 ? 1 : 0), 0);
  const totalNitaContribution = nitaMembers * P10_NITA_PER_MEMBER;

  const totalPayePayable = round2(payeFromEmployees + 0 + 0 + 0); // 2+3+4+5 (lump sum/FBT/without-pin already in 2)
  const totalPayable = round2(totalPayePayable + totalHousingLevy + totalNitaContribution);

  const basicInfo: P10BasicInfo = {
    employerPin: meta.employerPin,
    employerName: meta.employerName,
    returnType: meta.returnType?.trim() || P10_RETURN_TYPE_ORIGINAL,
    entityType: meta.entityType?.trim() || P10_ENTITY_HEAD_OFFICE,
    returnPeriodFrom: ddmmyyyy(1, month, year),
    returnPeriodTo: ddmmyyyy(lastDayOfMonth(month, year), month, year),
    month,
    monthName: MONTH_NAMES[month - 1] ?? String(month),
    year,
    hasLumpSumOrFbt: 'No',
  };

  const taxDue: P10TaxDue = {
    totalEmployees: rows.length,
    payeFromEmployees,
    payeOnLumpSum: 0,
    fringeBenefitTax: 0,
    payeFromEmployeesWithoutPin,
    totalPayePayable,
    totalHousingLevy,
    nitaMembers,
    totalNitaContribution,
    totalPayable,
  };

  return { meta: { ...meta, rates }, basicInfo, rows, taxDue };
}

/** Section B columns in the exact template order (header label + row accessor). */
const SECTION_B_COLUMNS: Array<{ label: string; get: (r: P10SectionBRow) => string | number }> = [
  { label: 'PIN of Employee', get: (r) => r.pin },
  { label: 'Name of Employee', get: (r) => r.name },
  { label: 'Resident Status', get: (r) => r.residentStatus },
  { label: 'Type of Employee', get: (r) => r.employeeType },
  { label: 'Persons With Disability (PWD)', get: (r) => r.pwd },
  { label: 'Exemption Certificate Number', get: (r) => r.exemptionCertificateNumber },
  { label: 'Total Cash Pay', get: (r) => r.totalCashPay },
  { label: 'Value of Car Benefit', get: (r) => r.carBenefit },
  { label: 'Value of Meals', get: (r) => r.meals },
  { label: 'Non Cash Benefits', get: (r) => r.nonCashBenefits },
  { label: 'Type of Housing', get: (r) => r.typeOfHousing },
  { label: 'Housing Benefit', get: (r) => r.housingBenefit },
  { label: 'Other Benefits', get: (r) => r.otherBenefits },
  { label: 'Total Gross Pay', get: (r) => r.totalGrossPay },
  { label: 'Social Health Insurance Fund (SHIF)', get: (r) => r.shif },
  { label: 'NSSF Contribution', get: (r) => r.nssf },
  { label: 'Other Pension Contribution', get: (r) => r.otherPension },
  { label: 'Post Retirement Medical Fund', get: (r) => r.postRetirementMedical },
  { label: 'Mortgage Interest', get: (r) => r.mortgageInterest },
  { label: 'Affordable Housing Levy', get: (r) => r.affordableHousingLevy },
  { label: 'Taxable Pay', get: (r) => r.taxablePay },
  { label: 'Monthly Personal Relief', get: (r) => r.personalRelief },
  { label: 'Amount of Insurance Relief', get: (r) => r.insuranceRelief },
  { label: 'PAYE Tax', get: (r) => r.payeTax },
  { label: 'Self Assessed PAYE Tax', get: (r) => r.selfAssessedPaye },
  { label: 'Deposit on Home Ownership Saving Plan', get: (r) => r.hosp },
];

/** Column headers for the Section B CSV (KRA on-screen order). */
export const P10_SECTION_B_HEADERS = SECTION_B_COLUMNS.map((c) => c.label);

function csvCell(value: string | number): string {
  const s = typeof value === 'number' ? String(value) : value;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Serialize Section B to CSV in the template's column order.
 * @param includeHeader include the KRA label header row (default true).
 */
export function p10SectionBToCsv(ret: P10Return, includeHeader = true): string {
  const lines: string[] = [];
  if (includeHeader) lines.push(P10_SECTION_B_HEADERS.map(csvCell).join(','));
  for (const r of ret.rows) {
    lines.push(SECTION_B_COLUMNS.map((c) => csvCell(c.get(r))).join(','));
  }
  return lines.join('\r\n');
}
