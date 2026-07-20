import { createPayrollImportPreviewHandler } from '@/lib/payroll-api/import-preview';

export const POST = createPayrollImportPreviewHandler({ scope: 'internal' });
