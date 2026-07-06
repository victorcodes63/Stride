import type { ModuleKey } from '@/lib/modules';
import { NAV_SECTION_MODULES } from '@/lib/module-registry';
import { ESS_NAV_MODULES, NAV_ITEM_MODULES, resolveModuleForPath } from '@/lib/module-routes';

export type EnabledModulesMap = Record<ModuleKey, boolean>;

function normalizeNavHref(href: string): string {
  return href.split('?')[0] ?? href;
}

function resolveNavItemModule(href: string): ModuleKey | null {
  const path = normalizeNavHref(href);
  return NAV_ITEM_MODULES[path] ?? resolveModuleForPath(path);
}

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

  const boundModule = resolveNavItemModule(href);
  if (boundModule) return enabled[boundModule] === true;

  const sectionModules = NAV_SECTION_MODULES[sectionId];
  if (!sectionModules?.length) return true;

  if (sectionId === 'people-hr') {
    return enabled.core === true;
  }

  if (sectionId === 'time-attendance') {
    if (href.includes('/leave')) return enabled.leave === true;
    return enabled.time === true;
  }

  if (sectionId === 'legal-documents') {
    if (href.startsWith('/dashboard/company-documents')) return enabled.documents === true;
    return enabled.core === true;
  }

  if (sectionId === 'healthcare') {
    return enabled.healthcare === true;
  }

  if (sectionId === 'sacco') {
    return enabled.sacco === true;
  }

  if (sectionId === 'energy') {
    return enabled.energy === true;
  }

  if (sectionId === 'construction') {
    return enabled.construction === true;
  }

  if (
    sectionId === 'fleet-operations' ||
    sectionId === 'fleet-monitoring' ||
    sectionId === 'fleet-assets' ||
    sectionId === 'fleet-commercial'
  ) {
    return enabled.fleet === true;
  }

  if (
    sectionId === 'outsourcing-clients' ||
    sectionId === 'outsourcing-workforce' ||
    sectionId === 'outsourcing-services'
  ) {
    return enabled.outsourcing === true;
  }

  if (sectionId === 'operations') {
    if (href.startsWith('/dashboard/assets')) return enabled.assets === true;
    if (href.startsWith('/dashboard/hse')) return enabled.hse === true;
    return false;
  }

  if (sectionId === 'communications-insight') {
    if (href.startsWith('/dashboard/announcements')) return enabled.communications === true;
    return enabled.reports === true;
  }

  if (sectionId === 'projects') {
    return enabled.projects === true;
  }

  return sectionModules.some((module) => enabled[module] === true);
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
  if (href.startsWith('/ess/procurement')) return enabled.procurement;
  return true;
}

export function filterEssNavItems<T extends { href: string }>(
  items: T[],
  enabled: EnabledModulesMap,
): T[] {
  return items.filter((item) => isEssNavItemVisible(item.href, enabled));
}
