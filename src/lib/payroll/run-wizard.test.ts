import { describe, expect, it } from 'vitest';
import {
  buildEmployeeReadinessRows,
  computePayrollVariance,
  derivePayrollRunState,
  employeeReadinessIssues,
  priorPayrollPeriod,
  sumPayrollTotals,
} from './run-wizard';

describe('priorPayrollPeriod', () => {
  it('rolls back to December of prior year', () => {
    expect(priorPayrollPeriod(1, 2026)).toEqual({ month: 12, year: 2025 });
  });

  it('decrements month within same year', () => {
    expect(priorPayrollPeriod(6, 2026)).toEqual({ month: 5, year: 2026 });
  });
});

describe('employeeReadinessIssues', () => {
  it('flags missing statutory and bank fields', () => {
    expect(
      employeeReadinessIssues({
        kraPin: '',
        nssfNumber: 'NSSF-1',
        bankName: 'KCB',
        bankAccountNumber: null,
      }),
    ).toEqual(['missing_pin', 'missing_bank']);
  });
});

describe('buildEmployeeReadinessRows', () => {
  it('counts ready employees and lists issues', () => {
    const { rows, readyCount } = buildEmployeeReadinessRows([
      {
        id: '1',
        firstName: 'Jane',
        lastName: 'Doe',
        employeeNumber: '001',
        kraPin: 'A123',
        nssfNumber: 'N1',
        bankName: 'KCB',
        bankAccountNumber: '123',
      },
      {
        id: '2',
        firstName: 'John',
        lastName: 'Smith',
        employeeNumber: '002',
        kraPin: null,
        nssfNumber: null,
        bankName: null,
        bankAccountNumber: null,
      },
    ]);
    expect(readyCount).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.issues).toEqual(['missing_pin', 'missing_nssf', 'missing_bank']);
  });
});

describe('sumPayrollTotals', () => {
  it('aggregates payroll amounts', () => {
    const totals = sumPayrollTotals([
      { grossPay: 100000, netPay: 80000, paye: 10000, nssf: 5000, nhif: 2000, ahl: 1500 },
      { grossPay: 50000, netPay: 42000, paye: 4000, nssf: 2500, nhif: 1000, ahl: 750 },
    ]);
    expect(totals.gross).toBe(150000);
    expect(totals.net).toBe(122000);
    expect(totals.headcount).toBe(2);
  });
});

describe('derivePayrollRunState', () => {
  const base = { staffCount: 5, payrollCount: 5, draftCount: 0, approvedCount: 0, paidCount: 0 };

  it('is needs_setup when there is no workforce and no run', () => {
    expect(
      derivePayrollRunState({ staffCount: 0, payrollCount: 0, draftCount: 0, approvedCount: 0, paidCount: 0 }),
    ).toBe('needs_setup');
  });

  it('is ready_to_generate when staff exist but no records', () => {
    expect(
      derivePayrollRunState({ staffCount: 5, payrollCount: 0, draftCount: 0, approvedCount: 0, paidCount: 0 }),
    ).toBe('ready_to_generate');
  });

  it('is draft when any draft records remain', () => {
    expect(derivePayrollRunState({ ...base, draftCount: 2, approvedCount: 3 })).toBe('draft');
  });

  it('is approved when approved but not fully paid', () => {
    expect(derivePayrollRunState({ ...base, approvedCount: 5 })).toBe('approved');
    expect(derivePayrollRunState({ ...base, approvedCount: 2, paidCount: 3 })).toBe('approved');
  });

  it('is paid when every record is paid', () => {
    expect(derivePayrollRunState({ ...base, paidCount: 5 })).toBe('paid');
  });
});

describe('computePayrollVariance', () => {
  it('computes month-over-month deltas', () => {
    const result = computePayrollVariance(
      [
        { employeeId: 'a', employeeName: 'A', grossPay: 110000, netPay: 88000 },
        { employeeId: 'b', employeeName: 'B', grossPay: 50000, netPay: 42000 },
      ],
      [
        { employeeId: 'a', grossPay: 100000, netPay: 80000 },
        { employeeId: 'b', grossPay: 50000, netPay: 42000 },
      ],
      { month: 2, year: 2026 },
    );
    expect(result.priorMonth).toBe(2);
    expect(result.grossDelta).toBe(10000);
    expect(result.netDelta).toBe(8000);
    expect(result.grossDeltaPct).toBe(6.7);
    expect(result.rows[0]?.employeeId).toBe('a');
  });
});
