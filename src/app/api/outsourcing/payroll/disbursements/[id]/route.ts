import { createPayrollDisbursementDetailHandler } from '@/lib/payroll-api/disbursement-detail';

export const GET = createPayrollDisbursementDetailHandler({ scope: 'outsourcing' });
