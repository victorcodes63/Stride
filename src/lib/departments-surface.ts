export type DepartmentsSurfaceConfig = {
  mode: 'internal' | 'outsourcing';
  basePath: string;
  /** List/create: `/api/departments` or `/api/outsourcing/clients/:id/departments` */
  apiBase: string;
  /** Employee picker for department head */
  employeesApi: string;
  showClientSwitcher: boolean;
};

export const INTERNAL_DEPARTMENTS_SURFACE: DepartmentsSurfaceConfig = {
  mode: 'internal',
  basePath: '/dashboard/departments',
  apiBase: '/api/departments',
  employeesApi: '/api/employees?limit=500',
  showClientSwitcher: false,
};

export const OUTSOURCING_DEPARTMENTS_SURFACE: DepartmentsSurfaceConfig = {
  mode: 'outsourcing',
  basePath: '/dashboard/outsourcing/departments',
  apiBase: '', // filled with client id at runtime
  employeesApi: '',
  showClientSwitcher: true,
};

export function departmentsSurfaceFromPathname(pathname: string | null | undefined): DepartmentsSurfaceConfig {
  if (pathname?.includes('/outsourcing/')) return OUTSOURCING_DEPARTMENTS_SURFACE;
  return INTERNAL_DEPARTMENTS_SURFACE;
}

export function outsourcingDepartmentsApi(clientId: string) {
  return `/api/outsourcing/clients/${clientId}/departments`;
}

export function outsourcingEmployeesApi(clientId: string) {
  return `/api/outsourcing/employees?clientId=${encodeURIComponent(clientId)}&limit=500`;
}
