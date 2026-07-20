import { createPayrollImportCreateMissingEmployeesHandler } from '@/lib/payroll-api/import-create-missing-employees';

export const POST = createPayrollImportCreateMissingEmployeesHandler({ scope: 'outsourcing' });
