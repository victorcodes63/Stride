import { createPayrollImportCommitHandler } from '@/lib/payroll-api/import-commit';

export const POST = createPayrollImportCommitHandler({ scope: 'outsourcing' });
