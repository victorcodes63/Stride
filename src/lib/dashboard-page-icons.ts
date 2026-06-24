import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Banknote,
  BarChart2,
  BookOpen,
  Building2,
  CalendarOff,
  Clock4,
  LayoutGrid,
  ListTodo,
  UserCog,
  Users,
} from 'lucide-react';
import {
  ALL_MODULES_ENABLED,
  buildDashboardNavSections,
  flattenDashboardNavItems,
  OVERVIEW_NAV_ITEM,
} from '@/lib/dashboard-nav-catalog';

/** Routes reachable in the app but absent from (or aliased vs) the sidebar catalog. */
const EXTRA_PAGE_ICON_ROUTES: Record<string, LucideIcon> = {
  '/dashboard/outsourcing/employees': Users,
  '/dashboard/outsourcing/departments': Building2,
  '/dashboard/outsourcing/attendance': Clock4,
  '/dashboard/outsourcing/payroll': Banknote,
  '/dashboard/outsourcing/leave': CalendarOff,
  '/dashboard/outsourcing/clients': Building2,
  '/dashboard/staff-leave': CalendarOff,
  '/dashboard/staff': UserCog,
  '/dashboard/clients': Building2,
  '/dashboard/insights': BookOpen,
  '/dashboard/people': Users,
  '/dashboard/people/tasks': ListTodo,
  '/dashboard/operations': LayoutGrid,
  '/dashboard/people/performance': BarChart2,
  '/dashboard/admin/company-setup': Building2,
  '/dashboard/module-unavailable': AlertTriangle,
  '/dashboard/accounts/payroll': Banknote,
};

let cachedIconMap: Map<string, LucideIcon> | null = null;

function buildDashboardPageIconMap(): Map<string, LucideIcon> {
  const map = new Map<string, LucideIcon>();
  map.set(OVERVIEW_NAV_ITEM.href, OVERVIEW_NAV_ITEM.icon);

  const sections = buildDashboardNavSections({
    currentUserRole: 'admin',
    hasAccountsAccess: true,
    canViewSystemAnalytics: true,
    enabledModules: ALL_MODULES_ENABLED,
  });

  for (const item of flattenDashboardNavItems(sections, false)) {
    const href = item.href.split('?')[0];
    map.set(href, item.icon);
  }

  for (const [href, icon] of Object.entries(EXTRA_PAGE_ICON_ROUTES)) {
    map.set(href, icon);
  }

  return map;
}

function getDashboardPageIconMap(): Map<string, LucideIcon> {
  if (!cachedIconMap) cachedIconMap = buildDashboardPageIconMap();
  return cachedIconMap;
}

function normalizeDashboardPath(pathname: string): string {
  const base = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  if (base.length > 1 && base.endsWith('/')) return base.slice(0, -1);
  return base || '/dashboard';
}

/** Resolve the standard Lucide icon for a dashboard route (longest-prefix match). */
export function resolveDashboardPageIcon(pathname: string): LucideIcon {
  const path = normalizeDashboardPath(pathname);
  const map = getDashboardPageIconMap();

  const exact = map.get(path);
  if (exact) return exact;

  const prefixes = [...map.keys()].sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (path.startsWith(`${prefix}/`)) return map.get(prefix)!;
  }

  return LayoutGrid;
}
