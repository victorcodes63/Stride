export type EmployeeReadinessIssue = 'missing_pin' | 'missing_nssf' | 'missing_bank';

export type EmployeeReadinessRow = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  issues: EmployeeReadinessIssue[];
};

export type PayrollRunTotals = {
  gross: number;
  net: number;
  paye: number;
  nssf: number;
  nhif: number;
  ahl: number;
  headcount: number;
};

export type PayrollVarianceRow = {
  employeeId: string;
  employeeName: string;
  currentGross: number;
  priorGross: number | null;
  grossDelta: number | null;
  currentNet: number;
  priorNet: number | null;
  netDelta: number | null;
};

export function priorPayrollPeriod(month: number, year: number): { month: number; year: number } {
  if (month <= 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
}

function isBlank(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === '';
}

export function employeeReadinessIssues(input: {
  kraPin?: string | null;
  nssfNumber?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
}): EmployeeReadinessIssue[] {
  const issues: EmployeeReadinessIssue[] = [];
  if (isBlank(input.kraPin)) issues.push('missing_pin');
  if (isBlank(input.nssfNumber)) issues.push('missing_nssf');
  if (isBlank(input.bankName) || isBlank(input.bankAccountNumber)) issues.push('missing_bank');
  return issues;
}

export function buildEmployeeReadinessRows(
  employees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string | null;
    kraPin: string | null;
    nssfNumber: string | null;
    bankName: string | null;
    bankAccountNumber: string | null;
  }>,
): { rows: EmployeeReadinessRow[]; readyCount: number } {
  const rows: EmployeeReadinessRow[] = [];
  let readyCount = 0;
  for (const e of employees) {
    const issues = employeeReadinessIssues(e);
    if (issues.length === 0) readyCount += 1;
    else {
      rows.push({
        employeeId: e.id,
        employeeName: `${e.firstName} ${e.lastName}`.trim(),
        employeeNumber: e.employeeNumber,
        issues,
      });
    }
  }
  return { rows, readyCount };
}

export function sumPayrollTotals(
  payrolls: Array<{
    grossPay: number | string;
    netPay: number | string;
    paye: number | string;
    nssf: number | string;
    nhif: number | string;
    ahl?: number | string | null;
  }>,
): PayrollRunTotals {
  const totals = payrolls.reduce(
    (acc, p) => {
      acc.gross += Number(p.grossPay) || 0;
      acc.net += Number(p.netPay) || 0;
      acc.paye += Number(p.paye) || 0;
      acc.nssf += Number(p.nssf) || 0;
      acc.nhif += Number(p.nhif) || 0;
      acc.ahl += Number(p.ahl ?? 0) || 0;
      return acc;
    },
    { gross: 0, net: 0, paye: 0, nssf: 0, nhif: 0, ahl: 0 },
  );
  return { ...totals, headcount: payrolls.length };
}

export function computePayrollVariance(
  current: Array<{
    employeeId: string;
    employeeName: string;
    grossPay: number | string;
    netPay: number | string;
  }>,
  prior: Array<{
    employeeId: string;
    grossPay: number | string;
    netPay: number | string;
  }>,
  priorPeriod: { month: number; year: number },
): {
  priorMonth: number;
  priorYear: number;
  grossDelta: number;
  netDelta: number;
  grossDeltaPct: number | null;
  rows: PayrollVarianceRow[];
} {
  const priorByEmployee = new Map(prior.map((p) => [p.employeeId, p]));
  let grossDelta = 0;
  let netDelta = 0;
  let priorGrossTotal = 0;
  const rows: PayrollVarianceRow[] = current.map((c) => {
    const priorRow = priorByEmployee.get(c.employeeId);
    const currentGross = Number(c.grossPay) || 0;
    const currentNet = Number(c.netPay) || 0;
    const priorGross = priorRow != null ? Number(priorRow.grossPay) || 0 : null;
    const priorNet = priorRow != null ? Number(priorRow.netPay) || 0 : null;
    const rowGrossDelta = priorGross != null ? currentGross - priorGross : null;
    const rowNetDelta = priorNet != null ? currentNet - priorNet : null;
    if (priorGross != null) {
      grossDelta += rowGrossDelta ?? 0;
      priorGrossTotal += priorGross;
    }
    if (priorNet != null) netDelta += rowNetDelta ?? 0;
    return {
      employeeId: c.employeeId,
      employeeName: c.employeeName,
      currentGross,
      priorGross,
      grossDelta: rowGrossDelta,
      currentNet,
      priorNet,
      netDelta: rowNetDelta,
    };
  });
  const grossDeltaPct =
    priorGrossTotal > 0 ? Math.round((grossDelta / priorGrossTotal) * 1000) / 10 : null;
  return {
    priorMonth: priorPeriod.month,
    priorYear: priorPeriod.year,
    grossDelta,
    netDelta,
    grossDeltaPct,
    rows: rows.sort((a, b) => Math.abs(b.grossDelta ?? 0) - Math.abs(a.grossDelta ?? 0)),
  };
}

export function inferWizardStep(input: {
  payrollCount: number;
  draftCount: number;
  approvedCount: number;
}): 'period' | 'validate' | 'generate' | 'review' | 'approve' | 'export' {
  if (input.payrollCount === 0) return 'validate';
  if (input.draftCount > 0) return 'review';
  if (input.approvedCount > 0) return 'export';
  return 'review';
}
