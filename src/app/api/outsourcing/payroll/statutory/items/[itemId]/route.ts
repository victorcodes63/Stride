import { createPayrollStatutoryItemPatchHandler } from '@/lib/payroll-api/statutory-item';

export const PATCH = createPayrollStatutoryItemPatchHandler({ scope: 'outsourcing' });
