import {
  createPayrollStatutoryGetHandler,
  createPayrollStatutoryPostHandler,
} from '@/lib/payroll-api/statutory';

export const GET = createPayrollStatutoryGetHandler({ scope: 'outsourcing' });
export const POST = createPayrollStatutoryPostHandler({ scope: 'outsourcing' });
