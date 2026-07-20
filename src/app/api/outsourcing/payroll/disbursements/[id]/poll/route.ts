import { createPayrollDisbursementPollHandler } from '@/lib/payroll-api/disbursement-detail';

export const POST = createPayrollDisbursementPollHandler({ scope: 'outsourcing' });
