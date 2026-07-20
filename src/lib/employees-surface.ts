import type { PayrollSurfaceMode } from '@/components/payroll/PayrollWorkspace';

export type EmployeesSurfaceMode = PayrollSurfaceMode;

export type EmployeesSurfaceConfig = {
  mode: EmployeesSurfaceMode;
  /** Dashboard base, e.g. `/dashboard/employees` */
  basePath: string;
  /** Employee CRUD API base, e.g. `/api/employees` */
  apiBase: string;
  /** Departments list for filters / bulk assign (internal only uses this). */
  departmentsApi: string;
  /** Payslip send / open paths for bulk actions on the directory. */
  payrollBasePath: string;
  payrollApiBase: string;
  /** Show end-client switcher (outsourcing only). */
  showClientSwitcher: boolean;
};

/** HR & Payroll — company's own workforce (gated by `core`). */
export const INTERNAL_EMPLOYEES_SURFACE: EmployeesSurfaceConfig = {
  mode: 'internal',
  basePath: '/dashboard/employees',
  apiBase: '/api/employees',
  departmentsApi: '/api/departments',
  payrollBasePath: '/dashboard/payroll',
  payrollApiBase: '/api/payroll',
  showClientSwitcher: false,
};

/** HR Outsourcing — end-client workforce (gated by `outsourcing`). */
export const OUTSOURCING_EMPLOYEES_SURFACE: EmployeesSurfaceConfig = {
  mode: 'outsourcing',
  basePath: '/dashboard/outsourcing/employees',
  apiBase: '/api/outsourcing/employees',
  departmentsApi: '', // resolved per client: `/api/outsourcing/clients/:id/departments`
  payrollBasePath: '/dashboard/outsourcing/payroll',
  payrollApiBase: '/api/outsourcing/payroll',
  showClientSwitcher: true,
};

export function employeesSurfaceFromPathname(pathname: string | null | undefined): EmployeesSurfaceConfig {
  if (pathname?.includes('/outsourcing/')) return OUTSOURCING_EMPLOYEES_SURFACE;
  return INTERNAL_EMPLOYEES_SURFACE;
}
