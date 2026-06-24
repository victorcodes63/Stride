/**
 * Six horizontal product domains — aligned with public marketing (CORE_MODULES).
 * Filtered by subscription entitlements via {@link filterDomainsForSwitcher}.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  Briefcase,
  Gavel,
  LayoutDashboard,
  LayoutGrid,
  ShoppingCart,
  Users,
} from 'lucide-react';
import type { DashboardNavItem, DashboardNavSection } from '@/lib/dashboard-nav-catalog';
import type { ModuleKey } from '@/lib/modules';
import type { DeploymentTier } from '@/lib/deployment-tier';
import { verticalAllowedOnTier } from '@/lib/entitlement-buckets';

export type DashboardModuleDomainId =
  | 'hr-payroll'
  | 'finance'
  | 'procurement'
  | 'legal-documents'
  | 'projects'
  | 'admin-operations';

export type DomainRollupReadiness = 'live' | 'partial' | 'planned';

export type DashboardModuleDomain = {
  id: DashboardModuleDomainId;
  /** Marketing label, e.g. "01 — HR & Payroll" */
  marketingLabel: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  hubHref: string;
  /** Nav section ids owned by this domain (see dashboard-nav-catalog). */
  sectionIds: string[];
  readiness: DomainRollupReadiness;
};

export const DASHBOARD_MODULE_DOMAINS: DashboardModuleDomain[] = [
  {
    id: 'hr-payroll',
    marketingLabel: '01 — HR & Payroll',
    shortLabel: 'HR & Payroll',
    icon: Users,
    description: 'People, leave, time, payroll, recruitment, ESS, and training.',
    hubHref: '/dashboard/people',
    sectionIds: ['people-hr', 'recruitment', 'time-attendance', 'payroll', 'employee-self-service', 'development'],
    readiness: 'partial',
  },
  {
    id: 'finance',
    marketingLabel: '02 — Finance',
    shortLabel: 'Finance',
    icon: Banknote,
    description: 'Invoicing, AP, expenses, budgets, and financial reports.',
    hubHref: '/dashboard/accounts',
    sectionIds: ['finance'],
    readiness: 'partial',
  },
  {
    id: 'procurement',
    marketingLabel: '03 — Procurement',
    shortLabel: 'Procurement',
    icon: ShoppingCart,
    description: 'Purchase requests, LPOs, vendor spend, and approvals.',
    hubHref: '/dashboard/procurement',
    sectionIds: ['procurement'],
    readiness: 'partial',
  },
  {
    id: 'legal-documents',
    marketingLabel: '04 — Legal & Documents',
    shortLabel: 'Legal',
    icon: Gavel,
    description: 'Contracts, credentials, policies, and compliance obligations.',
    hubHref: '/dashboard/legal',
    sectionIds: ['legal-documents'],
    readiness: 'partial',
  },
  {
    id: 'projects',
    marketingLabel: '05 — Projects',
    shortLabel: 'Projects',
    icon: Briefcase,
    description: 'Deliverables, tasks, and budget vs execution.',
    hubHref: '/dashboard/projects',
    sectionIds: ['projects'],
    readiness: 'planned',
  },
  {
    id: 'admin-operations',
    marketingLabel: '06 — Admin & Operations',
    shortLabel: 'Admin',
    icon: LayoutGrid,
    description: 'Fleet, assets, HSE, communications, reports, and system admin.',
    hubHref: '/dashboard/operations',
    sectionIds: ['operations', 'communications-insight', 'admin'],
    readiness: 'partial',
  },
];

const DOMAIN_BY_ID = Object.fromEntries(
  DASHBOARD_MODULE_DOMAINS.map((d) => [d.id, d]),
) as Record<DashboardModuleDomainId, DashboardModuleDomain>;

const SECTION_TO_DOMAIN = new Map<string, DashboardModuleDomainId>();
for (const domain of DASHBOARD_MODULE_DOMAINS) {
  for (const sectionId of domain.sectionIds) {
    SECTION_TO_DOMAIN.set(sectionId, domain.id);
  }
}

export function getDashboardModuleDomain(id: DashboardModuleDomainId): DashboardModuleDomain {
  return DOMAIN_BY_ID[id];
}

export function resolveDomainForSection(sectionId: string): DashboardModuleDomainId | null {
  return SECTION_TO_DOMAIN.get(sectionId) ?? null;
}

/** True on the cross-module overview route (`/dashboard`). */
export function isDashboardCommandCenterPath(pathname: string): boolean {
  const path = pathname.split('?')[0]?.split('#')[0] ?? '';
  return path === '/dashboard' || path === '/dashboard/';
}

/** Resolve active domain from the current dashboard path. */
export function resolveDomainForPath(pathname: string): DashboardModuleDomainId {
  const path = pathname.split('?')[0]?.split('#')[0] ?? '/dashboard';

  if (isDashboardCommandCenterPath(path)) return 'hr-payroll';

  if (path === '/dashboard/people' || path.startsWith('/dashboard/people/')) {
    if (path.startsWith('/dashboard/people/contracts')) return 'legal-documents';
    return 'hr-payroll';
  }

  if (path.startsWith('/dashboard/accounts')) return 'finance';
  if (path.startsWith('/dashboard/procurement')) return 'procurement';
  if (path.startsWith('/dashboard/legal')) return 'legal-documents';
  if (path.startsWith('/dashboard/projects')) return 'projects';
  if (path.startsWith('/dashboard/operations')) return 'admin-operations';

  if (
    path.startsWith('/dashboard/fleet') ||
    path.startsWith('/dashboard/assets') ||
    path.startsWith('/dashboard/hse') ||
    path.startsWith('/dashboard/announcements') ||
    path.startsWith('/dashboard/reports') ||
    path.startsWith('/dashboard/analytics') ||
    path.startsWith('/dashboard/admin') ||
    path.startsWith('/dashboard/users') ||
    path.startsWith('/dashboard/settings')
  ) {
    return 'admin-operations';
  }

  if (
    path.startsWith('/dashboard/credentials') ||
    path.startsWith('/dashboard/company-documents')
  ) {
    return 'legal-documents';
  }

  return 'hr-payroll';
}

export function resolveDomainForPathMeta(pathname: string): DashboardModuleDomain {
  return getDashboardModuleDomain(resolveDomainForPath(pathname));
}

/** Domain home link shown at the top of the focused sidebar. */
export function getDomainOverviewNavItem(domainId: DashboardModuleDomainId): DashboardNavItem {
  const domain = getDashboardModuleDomain(domainId);
  return { href: domain.hubHref, label: 'Overview', icon: LayoutDashboard };
}

/** Sidebar sections for the active topbar module only. */
export function filterNavSectionsForDomain(
  sections: DashboardNavSection[],
  domainId: DashboardModuleDomainId,
): DashboardNavSection[] {
  const domain = getDashboardModuleDomain(domainId);
  const allowed = new Set(domain.sectionIds);
  return sections.filter((section) => allowed.has(section.id));
}

export function isHrefInDomain(href: string, domainId: DashboardModuleDomainId): boolean {
  const base = href.split('?')[0] ?? href;
  if (base === getDomainOverviewNavItem(domainId).href.split('?')[0]) return true;
  return resolveDomainForPath(base) === domainId;
}

export const DOMAIN_REQUIRED_MODULES: Record<DashboardModuleDomainId, ModuleKey[]> = {
  'hr-payroll': ['core'],
  finance: ['accounts'],
  procurement: ['procurement'],
  'legal-documents': ['legal', 'documents'],
  projects: ['core'],
  'admin-operations': ['fleet', 'assets', 'reports', 'communications'],
};

export type DomainAccessState = 'active' | 'locked';

export function resolveDomainAccess(
  domainId: DashboardModuleDomainId,
  modules: Record<ModuleKey, boolean>,
  tier: DeploymentTier,
): DomainAccessState {
  if (domainId === 'hr-payroll' || domainId === 'finance') return 'active';

  if (domainId === 'admin-operations' && !verticalAllowedOnTier(tier)) {
    const anyVertical = DOMAIN_REQUIRED_MODULES['admin-operations'].some(
      (key) => modules[key],
    );
    return anyVertical ? 'active' : 'locked';
  }

  const keys = DOMAIN_REQUIRED_MODULES[domainId];
  return keys.some((key) => modules[key]) ? 'active' : 'locked';
}

export type DomainWithAccess = DashboardModuleDomain & { access: DomainAccessState };

export function filterDomainsForSwitcher(
  domains: DashboardModuleDomain[],
  modules: Record<ModuleKey, boolean>,
  tier: DeploymentTier,
): DomainWithAccess[] {
  return domains.map((domain) => ({
    ...domain,
    access: resolveDomainAccess(domain.id, modules, tier),
  }));
}
