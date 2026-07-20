import { createPayrollPayslipPdfHandler } from '@/lib/payroll-api/payslip-download';

export const GET = createPayrollPayslipPdfHandler({ scope: 'outsourcing' });
