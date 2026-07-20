import { createPayrollBankExportHandler } from '@/lib/payroll-api/bank-export';

export const GET = createPayrollBankExportHandler({ scope: 'outsourcing' });
