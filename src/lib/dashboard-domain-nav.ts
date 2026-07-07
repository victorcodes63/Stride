import {
  buildDashboardNavSections,
  type DashboardNavBuildOptions,
  type DashboardNavItem,
  type DashboardNavSection,
} from '@/lib/dashboard-nav-catalog';
import {
  filterNavSectionsForDomain,
  getDashboardModuleDomain,
  type DashboardModuleDomainId,
} from '@/lib/dashboard-module-domains';
import type { ModuleHomeWorkspace } from '@/lib/dashboard-module-homes';

export type DomainNavModuleItem = DashboardNavItem & {
  sectionLabel: string;
  sectionId: string;
};

function normalizeHref(href: string): string {
  return href.split('?')[0] ?? href;
}

/** Module hub links (e.g. /dashboard/accounts) — shown in sidebar as Overview, omitted from module grids. */
export function isDomainHubNavItem(href: string, domainId: DashboardModuleDomainId): boolean {
  const hub = normalizeHref(getDashboardModuleDomain(domainId).hubHref);
  return normalizeHref(href) === hub;
}

export function isSecondaryOverviewNavItem(item: DashboardNavItem): boolean {
  return item.label === 'Overview' && item.href !== '/dashboard';
}

export function getDomainNavSections(
  options: DashboardNavBuildOptions,
  domainId: DashboardModuleDomainId,
): DashboardNavSection[] {
  const all = buildDashboardNavSections(options);
  return filterNavSectionsForDomain(all, domainId);
}

export function getDomainNavModuleItems(
  options: DashboardNavBuildOptions,
  domainId: DashboardModuleDomainId,
): DomainNavModuleItem[] {
  const items: DomainNavModuleItem[] = [];
  for (const section of getDomainNavSections(options, domainId)) {
    for (const item of section.items) {
      if (isDomainHubNavItem(item.href, domainId)) continue;
      if (isSecondaryOverviewNavItem(item)) continue;
      items.push({ ...item, sectionLabel: section.label, sectionId: section.id });
    }
  }
  return items;
}

export function buildDomainWorkspacesFromNav(
  options: DashboardNavBuildOptions,
  domainId: DashboardModuleDomainId,
): ModuleHomeWorkspace[] {
  return getDomainNavSections(options, domainId)
    .map((section) => ({
      title: section.label,
      links: section.items
        .filter(
          (item) => !isDomainHubNavItem(item.href, domainId) && !isSecondaryOverviewNavItem(item),
        )
        .map((item) => ({
          href: item.href,
          label: item.label,
          icon: item.icon,
        })),
    }))
    .filter((workspace) => workspace.links.length > 0);
}

const DOMAIN_SEARCH_PLACEHOLDERS: Record<DashboardModuleDomainId, string> = {
  'hr-payroll': 'Search people, payroll, departments…',
  sales: 'Search pipeline, targets, attainment…',
  finance: 'Search clients, invoices, vendors…',
  procurement: 'Search purchase requests, LPOs, spend…',
  'legal-documents': 'Search contracts, credentials, policies…',
  projects: 'Search projects, tasks, deliverables…',
  'fleet-logistics': 'Search orders, trips, vehicles…',
  'hr-outsourcing': 'Search clients, employees, payroll…',
  'admin-operations': 'Search assets, HSE, reports…',
  'platform-admin': 'Search users, settings, audit log…',
};

export function getDomainSearchPlaceholder(domainId: DashboardModuleDomainId): string {
  return DOMAIN_SEARCH_PLACEHOLDERS[domainId] ?? 'Search…';
}

export function filterDomainNavItems(
  items: DomainNavModuleItem[],
  query: string,
): DomainNavModuleItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const haystack = `${item.label} ${item.sectionLabel} ${item.href}`.toLowerCase();
    return haystack.includes(q);
  });
}
