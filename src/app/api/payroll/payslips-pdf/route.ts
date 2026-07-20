import { createPayrollPayslipsPdfHandler } from '@/lib/payroll-api/payslip-download';

export const GET = createPayrollPayslipsPdfHandler({ scope: 'internal' });
