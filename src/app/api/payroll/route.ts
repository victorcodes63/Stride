import { createPayrollListHandler } from '@/lib/payroll-api/list';

export const GET = createPayrollListHandler({ scope: 'internal' });
