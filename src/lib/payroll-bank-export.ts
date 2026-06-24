/**
 * CSV bank file for bulk net-pay (salary) transfers — Kenya-style columns.
 */

const MONTH_ABBREV = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

export type BankExportPayrollRun = {
  month: number;
  year: number;
};

export type BankExportPayslipRow = {
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  netPay: number;
};

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function formatBankExportPaymentReference(month: number, year: number): string {
  const m = MONTH_ABBREV[Math.max(1, Math.min(12, month)) - 1] ?? 'MON';
  return `SAL-${m}-${year}`;
}

export function countMissingBankDetails(rows: BankExportPayslipRow[]): number {
  return rows.filter(
    (r) =>
      !(r.bankAccountNumber && String(r.bankAccountNumber).trim()) ||
      !(r.bankName && String(r.bankName).trim()),
  ).length;
}

/**
 * RFC 4180–style CSV (UTF-8). Rows include employees with incomplete bank data;
 * use {@link countMissingBankDetails} for UI warnings.
 */
export function buildBankExportCsv(
  payrollRun: BankExportPayrollRun,
  payslips: BankExportPayslipRow[],
): { csv: string; missingBankDetailsCount: number } {
  const headers = [
    'Employee Number',
    'Employee Name',
    'Bank Name',
    'Bank Branch',
    'Account Number',
    'Net Pay (KES)',
    'Payment Reference',
  ];
  const ref = formatBankExportPaymentReference(payrollRun.month, payrollRun.year);
  const missingBankDetailsCount = countMissingBankDetails(payslips);
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...payslips.map((slip) => {
      const name = `${slip.firstName} ${slip.lastName}`.trim();
      const row = [
        slip.employeeNumber ?? '',
        name,
        slip.bankName ?? '',
        slip.bankBranch ?? '',
        slip.bankAccountNumber ?? '',
        slip.netPay.toFixed(2),
        ref,
      ];
      return row.map((c) => escapeCsvCell(String(c))).join(',');
    }),
  ];
  return { csv: `\uFEFF${lines.join('\n')}`, missingBankDetailsCount };
}
