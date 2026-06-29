/**
 * Product domains for the module switcher — aligned with public marketing (CORE_MODULES).
 * Filtered by subscription entitlements via {@link filterDomainsForSwitcher}.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  Briefcase,
  Building2,
  Gavel,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react';
import type { UserRole } from '@/types/dashboard';
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
  | 'fleet-logistics'
  | 'admin-operations'
  | 'platform-admin';

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
    readiness: 'live',
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
    id: 'fleet-logistics',
    marketingLabel: '06 — Fleet management',
    shortLabel: 'Fleet management',
    icon: Truck,
    description:
      'Transport orders, trip dispatch, telematics, compliance, settlements, and client billing — Kenya-ready.',
    hubHref: '/dashboard/fleet',
    sectionIds: ['fleet-operations', 'fleet-monitoring', 'fleet-assets', 'fleet-commercial'],
    readiness: 'partial',
  },
  {
    id: 'admin-operations',
    marketingLabel: '07 — Operations',
    shortLabel: 'Operations',
    icon: Package,
    description: 'Assets, HSE, announcements, and operational reporting.',
    hubHref: '/dashboard/operations',
    sectionIds: ['operations', 'communications-insight'],
    readiness: 'partial',
  },
  {
    id: 'platform-admin',
    marketingLabel: '08 — Platform admin',
    shortLabel: 'Platform admin',
    icon: Building2,
    description: 'Company setup, system users, roles, holidays, audit log, and workspace settings.',
    hubHref: '/dashboard/platform',
    sectionIds: ['admin'],
    readiness: 'live',
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
  if (path.startsWith('/dashboard/fleet')) return 'fleet-logistics';
  if (path.startsWith('/dashboard/operations')) return 'admin-operations';
  if (path === '/dashboard/platform' || path.startsWith('/dashboard/platform/')) {
    return 'platform-admin';
  }

  if (
    path.startsWith('/dashboard/admin') ||
    path.startsWith('/dashboard/users') ||
    path.startsWith('/dashboard/settings')
  ) {
    return 'platform-admin';
  }

  if (
    path.startsWith('/dashboard/assets') ||
    path.startsWith('/dashboard/hse') ||
    path.startsWith('/dashboard/announcements') ||
    path.startsWith('/dashboard/reports') ||
    path.startsWith('/dashboard/analytics')
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
  'fleet-logistics': ['fleet'],
  'admin-operations': ['assets', 'hse', 'reports', 'communications'],
  'platform-admin': ['core'],
};

export type DomainAccessState = 'active' | 'locked';

export type SwitcherAccessContext = {
  canAccessPlatformAdmin?: boolean;
};

/** Mirrors admin nav section visibility in dashboard-nav-catalog. */
export function resolvePlatformAdminAccess(options: {
  currentUserRole?: UserRole | null;
  hasAccountsAccess?: boolean;
  canViewSystemAnalytics?: boolean;
  canAccessCompanySetup?: boolean;
}): boolean {
  return (
    options.currentUserRole === 'admin' ||
    options.canAccessCompanySetup === true ||
    options.hasAccountsAccess === true ||
    options.canViewSystemAnalytics === true
  );
}

export function resolveDomainAccess(
  domainId: DashboardModuleDomainId,
  modules: Record<ModuleKey, boolean>,
  tier: DeploymentTier,
  accessContext?: SwitcherAccessContext,
): DomainAccessState {
  if (domainId === 'platform-admin') {
    return accessContext?.canAccessPlatformAdmin ? 'active' : 'locked';
  }

  if (domainId === 'hr-payroll' || domainId === 'finance' || domainId === 'fleet-logistics') {
    return 'active';
  }

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
  accessContext?: SwitcherAccessContext,
): DomainWithAccess[] {
  return domains.map((domain) => ({
    ...domain,
    access: resolveDomainAccess(domain.id, modules, tier, accessContext),
  }));
}

/** Domains the current user can open — licensed modules and role-gated platform admin. */
export function filterActiveDomains(domains: DomainWithAccess[]): DomainWithAccess[] {
  return domains.filter((domain) => domain.access === 'active');
}
