/**
 * Payroll → General Ledger (GL) journal builder for Kenyan payroll runs.
 *
 * ============================================================================
 * ACCOUNTING MODEL (double-entry, balanced)
 * ============================================================================
 * For a payroll run we post one journal that recognises (a) the total employment
 * cost to the business and (b) the corresponding liabilities to statutory bodies,
 * employees and the bank. Debits must equal credits.
 *
 *   DEBITS (cost / expense to the employer)
 *   ---------------------------------------
 *   - Salaries & Wages expense            = Σ grossPay
 *   - Employer NSSF expense               = Σ nssf            (employer mirrors employee)
 *   - Employer AHL expense                = Σ ahl             (employer AHL 1.5% == employee ahl)
 *   - NITA expense                        = Σ nita            (employer-only training levy)
 *
 *   CREDITS (liabilities / cash out)
 *   --------------------------------
 *   - PAYE payable (KRA)                  = Σ paye
 *   - NSSF payable — employee portion     = Σ nssf
 *   - NSSF payable — employer portion     = Σ nssf            (== employee portion)
 *   - SHIF/NHIF payable                   = Σ nhif            (employee-only)
 *   - AHL payable — employee portion      = Σ ahl
 *   - AHL payable — employer portion      = Σ ahl             (== employee portion)
 *   - NITA payable                        = Σ nita
 *   - Net pay / bank clearing             = Σ netPay
 *
 * WHY THIS BALANCES
 * -----------------
 * On the employee side the identity holds when net pay only nets statutory items:
 *     grossPay = netPay + paye + nssf(employee) + nhif + ahl(employee)
 * so the employee-funded credits + net pay reconstruct the gross debit. The
 * employer contributions (NSSF, AHL, NITA) each appear as a matching
 * expense (DEBIT) and payable (CREDIT), so they are self-balancing.
 *
 * ASSUMPTIONS & CAVEATS
 * ---------------------
 * - `nssf` and `ahl` on each payroll record are the EMPLOYEE amounts. The
 *   employer contribution equals the employee amount (Kenya rules: employer NSSF
 *   mirrors employee NSSF; employer AHL 1.5% == employee AHL), so we double them
 *   on the payable side and expense the employer half separately.
 * - `nita` is an employer-only levy that does NOT reduce net pay; it is booked as
 *   both an expense and a payable.
 * - If a payroll record carries additional voluntary/other deductions that reduce
 *   net pay beyond the statutory items above, the journal will NOT balance using
 *   only these accounts. In that case `balanced` will be false and `difference`
 *   will surface the gap so it can be investigated (typically a missing
 *   "Other deductions payable" account in the caller's chart of accounts).
 * - All amounts are rounded to 2 decimal places before comparison.
 *
 * ============================================================================
 * CHART OF ACCOUNTS
 * ============================================================================
 * The account codes in {@link DEFAULT_GL_ACCOUNTS} are PLACEHOLDERS. They follow
 * a conventional layout (6xxx = expenses, 1xxx = assets, 2xxx = liabilities) but
 * MUST be overridden with the organisation's real chart of accounts. Override by
 * passing `options.accounts` to {@link buildPayrollJournal} (partial overrides
 * are merged over the defaults).
 */

/** A single GL account: its code and human-readable name. */
export interface GLAccount {
  code: string;
  name: string;
}

/** Logical keys used by the journal builder to look up GL accounts. */
export type GLAccountKey =
  | 'salariesExpense'
  | 'payeePayable'
  | 'nssfEmployeePayable'
  | 'nssfEmployerPayable'
  | 'shifPayable'
  | 'ahlEmployeePayable'
  | 'ahlEmployerPayable'
  | 'nitaPayable'
  | 'netPayClearing'
  | 'employerNssfExpense'
  | 'employerAhlExpense'
  | 'nitaExpense';

/**
 * DEFAULT account-code mapping — PLACEHOLDERS ONLY.
 *
 * ⚠️ Replace these codes with your real chart of accounts. They are intentionally
 * generic so the export works out of the box, but they are almost certainly NOT
 * the codes your accounting system expects.
 *
 * Convention used for the placeholders:
 *   6xxx = Expense accounts (P&L, DEBIT balances)
 *   1xxx = Asset accounts (bank / clearing)
 *   2xxx = Liability accounts (statutory & net-pay payables, CREDIT balances)
 */
export const DEFAULT_GL_ACCOUNTS: Record<GLAccountKey, GLAccount> = {
  // --- Expenses (DEBIT) ---
  salariesExpense: { code: '6000', name: 'Salaries & Wages Expense' },
  employerNssfExpense: { code: '6010', name: 'Employer NSSF Contribution Expense' },
  employerAhlExpense: { code: '6020', name: 'Employer AHL Contribution Expense' },
  nitaExpense: { code: '6030', name: 'NITA Training Levy Expense' },

  // --- Net pay / bank clearing (CREDIT on posting) ---
  netPayClearing: { code: '1000', name: 'Net Pay / Bank Clearing' },

  // --- Statutory & payroll liabilities (CREDIT) ---
  payeePayable: { code: '2100', name: 'PAYE Payable (KRA)' },
  nssfEmployeePayable: { code: '2110', name: 'NSSF Payable — Employee Portion' },
  nssfEmployerPayable: { code: '2111', name: 'NSSF Payable — Employer Portion' },
  shifPayable: { code: '2120', name: 'SHIF/NHIF Payable' },
  ahlEmployeePayable: { code: '2130', name: 'Affordable Housing Levy Payable — Employee Portion' },
  ahlEmployerPayable: { code: '2131', name: 'Affordable Housing Levy Payable — Employer Portion' },
  nitaPayable: { code: '2140', name: 'NITA Levy Payable' },
} as const;

/**
 * Minimal payroll record shape consumed by the journal builder. Numeric fields
 * accept Prisma Decimals, strings or numbers — they are normalised via
 * `Number(String(x))` to match the repo convention.
 */
export interface PayrollGLRecord {
  /** Department / cost-center name. Falsy values fall back to an "Unallocated" bucket. */
  costCenter?: string | null;
  grossPay: number | string;
  netPay: number | string;
  paye: number | string;
  nssf: number | string;
  nhif: number | string;
  ahl: number | string;
  nita: number | string;
}

/** One posted journal line. */
export interface JournalLine {
  costCenter: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
}

export interface BuildPayrollJournalOptions {
  /** Produce per-cost-center sub-journals (default true). When false, a single group is produced. */
  groupByCostCenter?: boolean;
  /** Partial override of the default chart of accounts. Merged over {@link DEFAULT_GL_ACCOUNTS}. */
  accounts?: Partial<Record<GLAccountKey, GLAccount>>;
  /** ISO date (YYYY-MM-DD) used for the journal / CSV Date column. Defaults to today. */
  date?: string;
  /** Label used when a record has no cost center. Defaults to "Unallocated". */
  unallocatedLabel?: string;
}

export interface PayrollJournalResult {
  /** Whether the detail lines are broken down per cost center. */
  groupedByCostCenter: boolean;
  /** ISO date used for the Date column. */
  date: string;
  /** Detail journal lines (per cost center when grouped, otherwise a single group). */
  lines: JournalLine[];
  /** Aggregate lines across ALL records (costCenter = "GRAND TOTAL"). */
  grandTotal: JournalLine[];
  /** Sum of all detail debits (2 dp). */
  totalDebit: number;
  /** Sum of all detail credits (2 dp). */
  totalCredit: number;
  /** totalDebit - totalCredit (2 dp). Zero when the journal balances. */
  difference: number;
  /** True when |difference| rounds to 0.00. */
  balanced: boolean;
  /** The (possibly overridden) chart of accounts used. */
  accounts: Record<GLAccountKey, GLAccount>;
}

const GRAND_TOTAL_LABEL = 'GRAND TOTAL';

/** Repo convention for turning Prisma Decimals/strings into numbers. */
function toNum(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = Number(String(value));
  return Number.isFinite(n) ? n : 0;
}

/** Round to 2 decimal places, guarding against floating point drift. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

interface GroupTotals {
  gross: number;
  net: number;
  paye: number;
  nssf: number;
  nhif: number;
  ahl: number;
  nita: number;
}

function emptyTotals(): GroupTotals {
  return { gross: 0, net: 0, paye: 0, nssf: 0, nhif: 0, ahl: 0, nita: 0 };
}

function accumulate(totals: GroupTotals, record: PayrollGLRecord): void {
  totals.gross += toNum(record.grossPay);
  totals.net += toNum(record.netPay);
  totals.paye += toNum(record.paye);
  totals.nssf += toNum(record.nssf);
  totals.nhif += toNum(record.nhif);
  totals.ahl += toNum(record.ahl);
  totals.nita += toNum(record.nita);
}

/** Build the balanced double-entry lines for a single cost-center bucket. */
function buildLinesForTotals(
  costCenter: string,
  totals: GroupTotals,
  accounts: Record<GLAccountKey, GLAccount>,
): JournalLine[] {
  const debit = (key: GLAccountKey, amount: number, description: string): JournalLine => ({
    costCenter,
    accountCode: accounts[key].code,
    accountName: accounts[key].name,
    description,
    debit: round2(amount),
    credit: 0,
  });
  const credit = (key: GLAccountKey, amount: number, description: string): JournalLine => ({
    costCenter,
    accountCode: accounts[key].code,
    accountName: accounts[key].name,
    description,
    debit: 0,
    credit: round2(amount),
  });

  const candidates: JournalLine[] = [
    // Debits (employer cost)
    debit('salariesExpense', totals.gross, 'Gross earnings'),
    debit('employerNssfExpense', totals.nssf, 'Employer NSSF contribution'),
    debit('employerAhlExpense', totals.ahl, 'Employer AHL contribution'),
    debit('nitaExpense', totals.nita, 'NITA training levy'),
    // Credits (liabilities / net pay)
    credit('payeePayable', totals.paye, 'PAYE withheld'),
    credit('nssfEmployeePayable', totals.nssf, 'NSSF — employee deduction'),
    credit('nssfEmployerPayable', totals.nssf, 'NSSF — employer contribution'),
    credit('shifPayable', totals.nhif, 'SHIF/NHIF deduction'),
    credit('ahlEmployeePayable', totals.ahl, 'AHL — employee deduction'),
    credit('ahlEmployerPayable', totals.ahl, 'AHL — employer contribution'),
    credit('nitaPayable', totals.nita, 'NITA levy payable'),
    credit('netPayClearing', totals.net, 'Net pay to employees'),
  ];

  // Drop zero-amount lines to keep the journal clean; balance is unaffected.
  return candidates.filter((line) => line.debit !== 0 || line.credit !== 0);
}

/**
 * Build a balanced payroll GL journal from payroll records.
 *
 * @param records Payroll records for a single run (month/year already filtered).
 * @param options See {@link BuildPayrollJournalOptions}.
 */
export function buildPayrollJournal(
  records: PayrollGLRecord[],
  options: BuildPayrollJournalOptions = {},
): PayrollJournalResult {
  const groupByCostCenter = options.groupByCostCenter ?? true;
  const unallocatedLabel = options.unallocatedLabel ?? 'Unallocated';
  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const accounts: Record<GLAccountKey, GLAccount> = {
    ...DEFAULT_GL_ACCOUNTS,
    ...(options.accounts ?? {}),
  };

  // Aggregate per cost center, preserving first-seen order.
  const buckets = new Map<string, GroupTotals>();
  const grand = emptyTotals();
  for (const record of records) {
    accumulate(grand, record);
    const key = groupByCostCenter
      ? (record.costCenter?.trim() || unallocatedLabel)
      : 'All cost centers';
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = emptyTotals();
      buckets.set(key, bucket);
    }
    accumulate(bucket, record);
  }

  const lines: JournalLine[] = [];
  for (const [costCenter, totals] of buckets) {
    lines.push(...buildLinesForTotals(costCenter, totals, accounts));
  }

  const grandTotal = buildLinesForTotals(GRAND_TOTAL_LABEL, grand, accounts);

  const totalDebit = round2(lines.reduce((sum, l) => sum + l.debit, 0));
  const totalCredit = round2(lines.reduce((sum, l) => sum + l.credit, 0));
  const difference = round2(totalDebit - totalCredit);

  return {
    groupedByCostCenter: groupByCostCenter,
    date,
    lines,
    grandTotal,
    totalDebit,
    totalCredit,
    difference,
    balanced: Math.abs(difference) < 0.005,
    accounts,
  };
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Render a journal as CSV with columns:
 *   Date,CostCenter,AccountCode,AccountName,Description,Debit,Credit
 *
 * Detail lines are emitted first, followed by the GRAND TOTAL lines (labelled in
 * the CostCenter column). A UTF-8 BOM is prepended to match the repo's other
 * CSV exports (Excel-friendly).
 */
export function journalToCsv(journal: PayrollJournalResult): string {
  const headers = ['Date', 'CostCenter', 'AccountCode', 'AccountName', 'Description', 'Debit', 'Credit'];
  const rowToCsv = (line: JournalLine): string =>
    [
      journal.date,
      line.costCenter,
      line.accountCode,
      line.accountName,
      line.description,
      line.debit ? line.debit.toFixed(2) : '',
      line.credit ? line.credit.toFixed(2) : '',
    ]
      .map((cell) => escapeCsvCell(String(cell)))
      .join(',');

  const bodyLines = [...journal.lines, ...journal.grandTotal].map(rowToCsv);
  return `\uFEFF${[headers.map(escapeCsvCell).join(','), ...bodyLines].join('\n')}`;
}
