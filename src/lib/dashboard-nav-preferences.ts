import { prisma } from '@/lib/prisma';
import { getAccountsAccess } from '@/lib/accounts-access';
import { canViewSystemAnalytics } from '@/lib/staff-permissions';
import {
  ALL_MODULES_ENABLED,
  buildDashboardNavSections,
  flattenDashboardNavItems,
} from '@/lib/dashboard-nav-catalog';
import { loadEffectiveModules } from '@/lib/company-setup';
import type { UserRole, StaffUserType } from '@/types/dashboard';

export const MAX_DASHBOARD_NAV_PINS = 12;

export function parsePinnedNavHrefs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const pins: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const href = entry.trim();
    if (!href.startsWith('/dashboard')) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    pins.push(href);
    if (pins.length >= MAX_DASHBOARD_NAV_PINS) break;
  }
  return pins;
}

export async function getAllowedDashboardNavHrefs(user: {
  id: string;
  role: UserRole;
  staffUserType: StaffUserType;
}): Promise<Set<string>> {
  const [accountsAccess, enabledModules] = await Promise.all([
    getAccountsAccess(user.id, user.role),
    loadEffectiveModules(),
  ]);

  const sections = buildDashboardNavSections({
    currentUserRole: user.role,
    hasAccountsAccess: accountsAccess.hasAccountsAccess,
    canViewSystemAnalytics: canViewSystemAnalytics(user.role, user.staffUserType),
    enabledModules: enabledModules ?? ALL_MODULES_ENABLED,
  });

  return new Set(flattenDashboardNavItems(sections).map((item) => item.href));
}

export function sanitizePinnedNavHrefs(pinned: string[], allowed: Set<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const href of pinned) {
    if (!allowed.has(href) || seen.has(href)) continue;
    seen.add(href);
    result.push(href);
    if (result.length >= MAX_DASHBOARD_NAV_PINS) break;
  }
  return result;
}

export async function getUserPinnedNavHrefs(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dashboardPinnedNav: true },
  });
  return parsePinnedNavHrefs(user?.dashboardPinnedNav);
}

export async function setUserPinnedNavHrefs(userId: string, pinned: string[]): Promise<string[]> {
  await prisma.user.update({
    where: { id: userId },
    data: { dashboardPinnedNav: pinned },
  });
  return pinned;
}
