import {
  createPayrollRecordGetHandler,
  createPayrollRecordPatchHandler,
} from '@/lib/payroll-api/record';

export const GET = createPayrollRecordGetHandler({ scope: 'outsourcing' });
export const PATCH = createPayrollRecordPatchHandler({ scope: 'outsourcing' });
