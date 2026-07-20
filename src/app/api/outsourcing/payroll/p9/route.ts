import { createPayrollP9Handler } from '@/lib/payroll-api/p9';

export const GET = createPayrollP9Handler({ scope: 'outsourcing' });
