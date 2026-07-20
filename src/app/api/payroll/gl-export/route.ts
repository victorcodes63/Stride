import { createPayrollGlExportHandler } from '@/lib/payroll-api/gl-export';

export const GET = createPayrollGlExportHandler({ scope: 'internal' });
