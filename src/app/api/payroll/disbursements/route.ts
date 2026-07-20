import {
  createPayrollDisbursementsCreateHandler,
  createPayrollDisbursementsListHandler,
} from '@/lib/payroll-api/disbursements';

export const GET = createPayrollDisbursementsListHandler({ scope: 'internal' });
export const POST = createPayrollDisbursementsCreateHandler({ scope: 'internal' });
