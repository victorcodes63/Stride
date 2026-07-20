import {
  createPayrollDisbursementsCreateHandler,
  createPayrollDisbursementsListHandler,
} from '@/lib/payroll-api/disbursements';

export const GET = createPayrollDisbursementsListHandler({ scope: 'outsourcing' });
export const POST = createPayrollDisbursementsCreateHandler({ scope: 'outsourcing' });
