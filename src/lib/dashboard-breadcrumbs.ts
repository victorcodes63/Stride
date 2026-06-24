import {
  buildDashboardNavSections,
  OVERVIEW_NAV_ITEM,
  type DashboardNavBuildOptions,
  type DashboardNavSection,
} from '@/lib/dashboard-nav-catalog';
import { isDeepDashboardPath } from '@/lib/dashboard-route-kind';

export { isDeepDashboardPath, isMainDashboardPage } from '@/lib/dashboard-route-kind';

export type DashboardBreadcrumb = {
  label: string;
  href?: string;
};

const SEGMENT_LABELS: Record<string, string> = {
  new: 'New',
  edit: 'Edit',
  schedule: 'Schedule',
  'credit-note': 'Credit note',
  payslips: 'Payslips',
  statutory: 'Statutory',
  analytics: 'Analytics',
  grievances: 'Grievances',
  cases: 'Cases',
  receipts: 'Receipts',
  vendors: 'Vendors',
  clients: 'Clients',
  invoices: 'Invoices',
  'vendor-bills': 'Vendor bills',
  statements: 'Statements',
  profile: 'Profile',
  organization: 'Organization',
  tasks: 'Tasks',
  contracts: 'Contracts',
  performance: 'Performance',
  staff: 'Staff',
  'ess-portal-users': 'ESS portal users',
  'roles-permissions': 'Roles & permissions',
  'audit-log': 'Audit log',
  holidays: 'Public holidays',
  'company-setup': 'Company setup',
  'biometric-devices': 'Biometric devices',
  attendance: 'Attendance',
  candidates: 'Talent pool',
  applications: 'Applications',
  jobs: 'Job openings',
  interviews: 'Interviews',
  onboarding: 'Onboarding',
  disciplinary: 'Disciplinary',
  credentials: 'Credentials',
  departments: 'Departments',
  employees: 'Employees',
  payroll: 'Payroll',
  rota: 'Rota & scheduling',
  leave: 'Leave',
  hse: 'Incidents',
  assets: 'Assets',
  reports: 'Reports',
  settings: 'Settings',
  users: 'System users',
  insights: 'Insights',
  accounts: 'Accounts',
  procurement: 'Procurement',
  'purchase-requests': 'Purchase requests',
  lpos: 'LPO register',
  spend: 'Spend',
  legal: 'Legal',
  obligations: 'Obligations',
  projects: 'Projects',
  board: 'Project board',
  disbursements: 'Disbursements',
  facilities: 'Facilities',
  governance: 'Governance',
  fleet: 'Fleet',
};

/** Routes not in the sidebar catalog but still reachable. */
const EXTRA_ROUTE_LABELS: Record<string, string> = {
  '/dashboard/staff-leave': 'Staff leave',
  '/dashboard/staff': 'Staff',
  '/dashboard/clients': 'Clients',
  '/dashboard/insights': 'Insights',
  '/dashboard/outsourcing/employees': 'Employees',
  '/dashboard/outsourcing/departments': 'Departments',
  '/dashboard/outsourcing/attendance': 'Attendance',
  '/dashboard/outsourcing/payroll': 'Payroll',
  '/dashboard/outsourcing/leave': 'Leave',
  '/dashboard/outsourcing/clients': 'Clients',
  '/dashboard/people/tasks': 'Tasks',
  '/dashboard/people/performance': 'Performance',
  '/dashboard/module-unavailable': 'Module unavailable',
};

function normalizePath(pathname: string): string {
  const base = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  if (base.length > 1 && base.endsWith('/')) return base.slice(0, -1);
  return base || '/dashboard';
}

function looksLikeId(segment: string): boolean {
  return segment.length >= 8 && /^[a-z0-9_-]+$/i.test(segment);
}

function titleCase(segment: string): string {
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function inferTailLabel(path: string, matchedHref: string | null): string {
  if (!matchedHref || path === matchedHref) {
    const segments = path.split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? 'Page';
    if (SEGMENT_LABELS[last]) return SEGMENT_LABELS[last];
    if (looksLikeId(last)) return 'Details';
    return titleCase(last);
  }

  const remainder = path.slice(matchedHref.length).split('/').filter(Boolean);
  if (remainder.length === 0) return 'Details';

  const parts = remainder.map((segment) => {
    if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
    if (looksLikeId(segment)) return 'Details';
    return titleCase(segment);
  });

  if (parts.length === 1 && parts[0] === 'Details') return 'Details';
  if (parts.includes('New')) return parts.includes('Employees') ? 'New employee' : `New ${parts.filter((p) => p !== 'New').join(' ').toLowerCase() || 'record'}`;
  if (parts.includes('Edit')) return 'Edit';
  if (parts.length === 1) return parts[0]!;
  return parts.join(' · ');
}

function findSectionForHref(sections: DashboardNavSection[], href: string): DashboardNavSection | null {
  for (const section of sections) {
    if (section.items.some((item) => href === item.href || href.startsWith(`${item.href}/`))) {
      return section;
    }
  }
  return null;
}

function findBestNavMatch(
  path: string,
  sections: DashboardNavSection[],
): { section: DashboardNavSection | null; itemHref: string | null; itemLabel: string | null } {
  const candidates: { href: string; label: string }[] = [OVERVIEW_NAV_ITEM];
  for (const section of sections) {
    for (const item of section.items) {
      candidates.push({ href: item.href.split('?')[0]!, label: item.label });
    }
  }

  candidates.sort((a, b) => b.href.length - a.href.length);

  for (const candidate of candidates) {
    if (path === candidate.href || path.startsWith(`${candidate.href}/`)) {
      return {
        section: findSectionForHref(sections, candidate.href),
        itemHref: candidate.href,
        itemLabel: candidate.label,
      };
    }
  }

  return { section: null, itemHref: null, itemLabel: null };
}

export function resolveDashboardBreadcrumbs(
  pathname: string,
  options: DashboardNavBuildOptions,
): DashboardBreadcrumb[] {
  const path = normalizePath(pathname);
  const sections = buildDashboardNavSections(options);
  const { itemHref, itemLabel } = findBestNavMatch(path, sections);

  if (!isDeepDashboardPath(path, itemHref)) {
    return [];
  }

  const parentLabel = itemLabel ?? EXTRA_ROUTE_LABELS[itemHref ?? ''] ?? 'Back';
  const parentHref = itemHref ?? '/dashboard';
  const currentLabel = inferTailLabel(path, itemHref);

  return [
    { label: parentLabel, href: parentHref },
    { label: currentLabel },
  ];
}
