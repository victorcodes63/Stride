import { createPayrollRecalculateStatutoryHandler } from '@/lib/payroll-api/recalculate-statutory';

export const POST = createPayrollRecalculateStatutoryHandler({ scope: 'internal' });
