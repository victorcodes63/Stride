import type { Payroll, StatutoryItemStatus, StatutoryObligationType } from '@prisma/client';

export type StatutoryTotals = {
  employeeCount: number;
  payrollCount: number;
  totalGrossPay: number;
  totalPaye: number;
  totalNssfEmployee: number;
  totalNssfEmployer: number;
  totalShif: number;
  totalAhlEmployee: number;
  totalAhlEmployer: number;
  totalOtherDeductions: number;
};

export type ObligationLine = {
  obligationType: StatutoryObligationType;
  authority: string;
  employeeAmount: number;
  employerAmount: number;
  liabilityAmount: number;
  dueDate: Date;
  status: StatutoryItemStatus;
};

type DeductionsLike = Array<{ name?: string; amount?: number | string }>;

export function to2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function numeric(v: unknown): number {
  const parsed = Number(v ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sumOtherDeductions(payrolls: Pick<Payroll, 'deductions'>[]): number {
  return to2(
    payrolls.reduce((acc, p) => {
      const rows = Array.isArray(p.deductions) ? (p.deductions as DeductionsLike) : [];
      const rowTotal = rows.reduce((s, row) => s + numeric(row?.amount), 0);
      return acc + rowTotal;
    }, 0),
  );
}

export function defaultDueDate(year: number, month: number): Date {
  // Kenya monthly payroll remittances are due on or before the 9th day of the following month.
  return new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 9));
}

export function buildStatutoryTotals(
  payrolls: Pick<Payroll, 'grossPay' | 'paye' | 'nssf' | 'nhif' | 'ahl' | 'deductions'>[],
  employeeCount: number,
): StatutoryTotals {
  const totalGrossPay = to2(payrolls.reduce((acc, p) => acc + numeric(p.grossPay), 0));
  const totalPaye = to2(payrolls.reduce((acc, p) => acc + numeric(p.paye), 0));
  const totalNssfEmployee = to2(payrolls.reduce((acc, p) => acc + numeric(p.nssf), 0));
  const totalShif = to2(payrolls.reduce((acc, p) => acc + numeric(p.nhif), 0));
  const totalAhlEmployee = to2(payrolls.reduce((acc, p) => acc + numeric(p.ahl), 0));
  const totalOtherDeductions = sumOtherDeductions(payrolls);

  return {
    employeeCount,
    payrollCount: payrolls.length,
    totalGrossPay,
    totalPaye,
    totalNssfEmployee,
    totalNssfEmployer: totalNssfEmployee,
    totalShif,
    totalAhlEmployee,
    totalAhlEmployer: totalAhlEmployee,
    totalOtherDeductions,
  };
}

export function buildObligationLines(
  totals: StatutoryTotals,
  month: number,
  year: number,
): ObligationLine[] {
  const dueDate = defaultDueDate(year, month);
  return [
    {
      obligationType: 'paye',
      authority: 'KRA iTax',
      employeeAmount: totals.totalPaye,
      employerAmount: 0,
      liabilityAmount: totals.totalPaye,
      dueDate,
      status: 'pending',
    },
    {
      obligationType: 'nssf',
      authority: 'NSSF Portal',
      employeeAmount: totals.totalNssfEmployee,
      employerAmount: totals.totalNssfEmployer,
      liabilityAmount: to2(totals.totalNssfEmployee + totals.totalNssfEmployer),
      dueDate,
      status: 'pending',
    },
    {
      obligationType: 'shif',
      authority: 'SHA Portal',
      employeeAmount: totals.totalShif,
      employerAmount: 0,
      liabilityAmount: totals.totalShif,
      dueDate,
      status: 'pending',
    },
    {
      obligationType: 'housing_levy',
      authority: 'KRA iTax',
      employeeAmount: totals.totalAhlEmployee,
      employerAmount: totals.totalAhlEmployer,
      liabilityAmount: to2(totals.totalAhlEmployee + totals.totalAhlEmployer),
      dueDate,
      status: 'pending',
    },
  ];
}

export function deriveReturnStatus(itemStatuses: StatutoryItemStatus[], dueDate: Date) {
  if (itemStatuses.length === 0) return 'draft' as const;
  if (itemStatuses.every((s) => s === 'paid')) return 'paid' as const;
  if (itemStatuses.every((s) => s === 'submitted' || s === 'paid')) return 'filed' as const;
  if (itemStatuses.some((s) => s === 'prepared' || s === 'submitted' || s === 'paid')) return 'review_ready' as const;
  const now = Date.now();
  if (dueDate.getTime() < now && itemStatuses.some((s) => s === 'pending')) return 'overdue' as const;
  return 'draft' as const;
}
