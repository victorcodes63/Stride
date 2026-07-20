import { createPayrollTrendsHandler } from '@/lib/payroll-api/trends';

export const GET = createPayrollTrendsHandler({ scope: 'internal' });
