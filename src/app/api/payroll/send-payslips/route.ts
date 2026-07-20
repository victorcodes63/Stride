import { createPayrollSendPayslipsHandler } from '@/lib/payroll-api/send-payslips';

export const POST = createPayrollSendPayslipsHandler({ scope: 'internal' });
