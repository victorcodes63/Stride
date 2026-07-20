import { createPayrollRunApproveHandler } from '@/lib/payroll-api/run-approve';

export const POST = createPayrollRunApproveHandler({ scope: 'internal' });
