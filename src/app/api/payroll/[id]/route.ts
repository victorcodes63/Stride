import {
  createPayrollRecordGetHandler,
  createPayrollRecordPatchHandler,
} from '@/lib/payroll-api/record';

export const GET = createPayrollRecordGetHandler({ scope: 'internal' });
export const PATCH = createPayrollRecordPatchHandler({ scope: 'internal' });
