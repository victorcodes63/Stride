import { createPayrollRunOverviewHandler } from '@/lib/payroll-api/run-overview';

export const GET = createPayrollRunOverviewHandler({ scope: 'internal' });
