import {
  createPayrollStatutoryGetHandler,
  createPayrollStatutoryPostHandler,
} from '@/lib/payroll-api/statutory';

export const GET = createPayrollStatutoryGetHandler({ scope: 'internal' });
export const POST = createPayrollStatutoryPostHandler({ scope: 'internal' });
