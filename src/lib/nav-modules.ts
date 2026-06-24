import type { ModuleKey } from '@/lib/modules';
import { ESS_NAV_MODULES, NAV_ITEM_MODULES, NAV_SECTION_MODULES } from '@/lib/module-routes';

export type EnabledModulesMap = Record<ModuleKey, boolean>;

export function isNavSectionVisible(sectionId: string, enabled: EnabledModulesMap | undefined): boolean {
  if (!enabled) return true;
  const required = NAV_SECTION_MODULES[sectionId];
  if (!required?.length) return true;
  return required.some((module) => enabled[module]);
}

export function isDashboardNavItemVisible(
  href: string,
  sectionId: string,
  enabled: EnabledModulesMap | undefined,
): boolean {
  if (!enabled) return true;
  const itemModule = NAV_ITEM_MODULES[href];
  if (itemModule) return enabled[itemModule];

  const sectionModules = NAV_SECTION_MODULES[sectionId];
  if (!sectionModules?.length) return true;

  if (sectionId === 'people-hr') {
    return enabled.core;
  }

  if (sectionId === 'time-attendance') {
    if (href.includes('/leave')) return enabled.leave;
    return enabled.time;
  }

  if (sectionId === 'legal-documents') {
    if (href.startsWith('/dashboard/company-documents')) return enabled.documents;
    return enabled.core;
  }

  if (sectionId === 'operations') {
    if (href.startsWith('/dashboard/fleet')) return enabled.fleet;
    if (href.startsWith('/dashboard/assets')) return enabled.assets;
    if (href.startsWith('/dashboard/hse')) return enabled.hse;
    return false;
  }

  if (sectionId === 'communications-insight') {
    if (href.startsWith('/dashboard/announcements')) return enabled.communications;
    return enabled.reports;
  }

  if (sectionId === 'procurement' || sectionId === 'projects') {
    return true;
  }

  return sectionModules.some((module) => enabled[module]);
}

export function isEssNavItemVisible(href: string, enabled: EnabledModulesMap): boolean {
  if (!enabled.ess) return false;
  if (href === '/ess' || href === '/ess/more' || href.startsWith('/ess/profile') || href === '/ess/account-security' || href === '/ess/install') {
    return true;
  }
  if (href === '/ess/work') {
    return enabled.leave || enabled.time || enabled.core;
  }
  if (href === '/ess/pay' || href.startsWith('/ess/pay/')) {
    return enabled.payroll;
  }
  if (href === '/ess/team' || href.startsWith('/ess/team/') || href === '/ess/leave-approvals') {
    return enabled.leave || enabled.time;
  }
  const itemModule = ESS_NAV_MODULES[href];
  if (itemModule) return enabled[itemModule];
  if (href.startsWith('/ess/onboarding') || href.startsWith('/ess/documents') || href.startsWith('/ess/credentials')) {
    return enabled.core;
  }
  if (href.startsWith('/ess/rota') || href.startsWith('/ess/attendance')) return enabled.time;
  if (href.startsWith('/ess/payslips')) return enabled.payroll;
  if (href.startsWith('/ess/hse')) return enabled.hse;
  if (href.startsWith('/ess/assets')) return enabled.assets;
  if (href.startsWith('/ess/performance')) return enabled.performance;
  return true;
}

export function filterEssNavItems<T extends { href: string }>(
  items: T[],
  enabled: EnabledModulesMap,
): T[] {
  return items.filter((item) => isEssNavItemVisible(item.href, enabled));
}
