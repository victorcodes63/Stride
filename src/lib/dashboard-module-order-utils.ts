import {
  DASHBOARD_MODULE_DOMAINS,
  type DashboardModuleDomain,
  type DashboardModuleDomainId,
} from '@/lib/dashboard-module-domains';
import type { StaffUserType, UserRole } from '@/types/dashboard';

export const CANONICAL_MODULE_ORDER: DashboardModuleDomainId[] = DASHBOARD_MODULE_DOMAINS.map(
  (domain) => domain.id,
);

const DOMAIN_ID_SET = new Set<DashboardModuleDomainId>(CANONICAL_MODULE_ORDER);

export function isDashboardModuleDomainId(value: string): value is DashboardModuleDomainId {
  return DOMAIN_ID_SET.has(value as DashboardModuleDomainId);
}

export function parseModuleOrderIds(value: unknown): DashboardModuleDomainId[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<DashboardModuleDomainId>();
  const order: DashboardModuleDomainId[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !isDashboardModuleDomainId(entry)) continue;
    if (seen.has(entry)) continue;
    seen.add(entry);
    order.push(entry);
  }
  return order;
}

/** Ensure every module appears once; append missing ids in canonical order. */
export function sanitizeModuleOrder(order: DashboardModuleDomainId[]): DashboardModuleDomainId[] {
  const seen = new Set<DashboardModuleDomainId>();
  const result: DashboardModuleDomainId[] = [];
  for (const id of order) {
    if (!isDashboardModuleDomainId(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  for (const id of CANONICAL_MODULE_ORDER) {
    if (!seen.has(id)) result.push(id);
  }
  return result;
}

export function orderModuleDomains(
  domains: DashboardModuleDomain[],
  orderIds: DashboardModuleDomainId[],
): DashboardModuleDomain[] {
  const byId = new Map(domains.map((domain) => [domain.id, domain]));
  const ordered = sanitizeModuleOrder(orderIds)
    .map((id) => byId.get(id))
    .filter((domain): domain is DashboardModuleDomain => Boolean(domain));
  return ordered.length === domains.length ? ordered : [...domains];
}

/** Role-aware default when the user has not saved a personal order. */
export function getDefaultModuleOrderForUser(input: {
  role: UserRole;
  staffUserType: StaffUserType;
  hasAccountsAccess?: boolean;
}): DashboardModuleDomainId[] {
  const { role, staffUserType, hasAccountsAccess } = input;

  if (role === 'admin' || staffUserType === 'director') {
    return [
      'hr-payroll',
      'finance',
      'admin-operations',
      'legal-documents',
      'procurement',
      'fleet-logistics',
      'hr-outsourcing',
      'projects',
      'platform-admin',
    ];
  }

  if (staffUserType === 'finance' || hasAccountsAccess) {
    return [
      'finance',
      'procurement',
      'hr-payroll',
      'legal-documents',
      'platform-admin',
      'admin-operations',
      'projects',
    ];
  }

  if (staffUserType === 'operations') {
    return [
      'admin-operations',
      'hr-outsourcing',
      'fleet-logistics',
      'hr-payroll',
      'finance',
      'procurement',
      'legal-documents',
      'projects',
    ];
  }

  return [...CANONICAL_MODULE_ORDER];
}
