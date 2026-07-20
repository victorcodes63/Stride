import { createPayrollGenerateHandler } from '@/lib/payroll-api/generate';

export const POST = createPayrollGenerateHandler({ scope: 'internal' });
