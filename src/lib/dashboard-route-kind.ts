'use client';

import {
  ALL_MODULES_ENABLED,
  buildDashboardNavSections,
  OVERVIEW_NAV_ITEM,
  type DashboardNavSection,
} from '@/lib/dashboard-nav-catalog';

const DEEP_PATH_SEGMENTS = new Set(['new', 'edit', 'schedule', 'credit-note', 'payslips']);

/** Routes not in the sidebar catalog but still reachable. */
const EXTRA_MAIN_ROUTES = new Set([
  '/dashboard/staff-leave',
  '/dashboard/staff',
  '/dashboard/clients',
  '/dashboard/insights',
  '/dashboard/outsourcing/employees',
  '/dashboard/outsourcing/departments',
  '/dashboard/outsourcing/attendance',
  '/dashboard/outsourcing/payroll',
  '/dashboard/outsourcing/leave',
  '/dashboard/outsourcing/clients',
  '/dashboard/people/tasks',
  '/dashboard/people/performance',
  '/dashboard/people',
  '/dashboard/operations',
  '/dashboard/procurement',
  '/dashboard/legal',
  '/dashboard/projects',
  '/dashboard/module-unavailable',
]);

function normalizePath(pathname: string): string {
  const base = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  if (base.length > 1 && base.endsWith('/')) return base.slice(0, -1);
  return base || '/dashboard';
}

function looksLikeId(segment: string): boolean {
  return segment.length >= 8 && /^[a-z0-9_-]+$/i.test(segment);
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

/** List and hub pages use the panel header only — breadcrumbs appear on nested routes. */
export function isDeepDashboardPath(pathname: string, itemHref: string | null): boolean {
  const path = normalizePath(pathname);
  if (path === '/dashboard') return false;
  if (EXTRA_MAIN_ROUTES.has(path)) return false;

  const segments = path.split('/').filter(Boolean);
  const last = segments[segments.length - 1] ?? '';

  if (DEEP_PATH_SEGMENTS.has(last)) return true;
  if (looksLikeId(last)) return true;

  if (itemHref) {
    if (path === itemHref) return false;
    if (path.startsWith(`${itemHref}/`)) return true;
  }

  return false;
}

/** Top-level list and hub routes — show header icons; nested detail/form routes do not. */
export function isMainDashboardPage(pathname: string): boolean {
  const path = normalizePath(pathname);
  const sections = buildDashboardNavSections({
    currentUserRole: 'admin',
    hasAccountsAccess: true,
    canViewSystemAnalytics: true,
    canAccessCompanySetup: true,
    enabledModules: ALL_MODULES_ENABLED,
  });
  const { itemHref } = findBestNavMatch(path, sections);
  return !isDeepDashboardPath(path, itemHref);
}
