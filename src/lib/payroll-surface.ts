import type { PayrollSurfaceConfig } from '@/components/payroll/PayrollWorkspace';

/** HR & Payroll — the company's own workforce, gated by the Payroll module. */
export const INTERNAL_PAYROLL_SURFACE: PayrollSurfaceConfig = {
  mode: 'internal',
  basePath: '/dashboard/payroll',
  apiBase: '/api/payroll',
  employeesPath: '/dashboard/employees',
};

/** HR Outsourcing — per end-client payroll, gated by the Outsourcing module. */
export const OUTSOURCING_PAYROLL_SURFACE: PayrollSurfaceConfig = {
  mode: 'outsourcing',
  basePath: '/dashboard/outsourcing/payroll',
  apiBase: '/api/outsourcing/payroll',
  employeesPath: '/dashboard/outsourcing/employees',
};
