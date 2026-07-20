import { createPayrollP10Handler } from '@/lib/payroll-api/p10';

export const GET = createPayrollP10Handler({ scope: 'internal' });
