import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  allModulesAdminEnabled,
  getModuleLabel,
  resolveEffectiveModules,
  type ModuleKey,
  type SubscriptionEntitlements,
} from '@/lib/modules';
import { parseModuleAdminFlagsCookie } from '@/lib/module-cookie';
import { parseEntitlementsCookie } from '@/lib/entitlements-cookie';
import { isModuleGuardExempt, resolveModuleForPath } from '@/lib/module-routes';

export type ModuleAccessDenied = {
  error: string;
  code: 'MODULE_DISABLED';
  module: ModuleKey;
  moduleLabel: string;
};

export function moduleAccessDeniedPayload(module: ModuleKey): ModuleAccessDenied {
  return {
    error: `The ${getModuleLabel(module)} module is not enabled on this deployment.`,
    code: 'MODULE_DISABLED',
    module,
    moduleLabel: getModuleLabel(module),
  };
}

export function getAdminFlagsFromRequest(request: NextRequest): Record<ModuleKey, boolean> {
  const cookie = request.cookies.get('hris_module_prefs')?.value;
  return parseModuleAdminFlagsCookie(cookie) ?? allModulesAdminEnabled();
}

export function getSubscriptionFromRequest(
  request: NextRequest,
): SubscriptionEntitlements | undefined {
  const cookie = parseEntitlementsCookie(
    request.cookies.get('hris_entitlements')?.value,
  );
  if (!cookie) return undefined;
  return {
    subscribedModules: cookie.modules,
    accountStatus: cookie.accountStatus,
    verticalEnginesAllowed: cookie.verticalEnginesAllowed,
  };
}

export function getEffectiveModulesFromRequest(request: NextRequest): Record<ModuleKey, boolean> {
  return resolveEffectiveModules(
    getAdminFlagsFromRequest(request),
    getSubscriptionFromRequest(request),
  );
}

export function isPathAllowedByModuleLicense(
  pathname: string,
  effectiveModules?: Record<ModuleKey, boolean>,
): boolean {
  if (isModuleGuardExempt(pathname)) return true;
  const moduleKey = resolveModuleForPath(pathname);
  if (!moduleKey) return true;
  const modules = effectiveModules ?? resolveEffectiveModules(allModulesAdminEnabled());
  return modules[moduleKey] === true;
}

export function getBlockedModuleForPath(
  pathname: string,
  effectiveModules?: Record<ModuleKey, boolean>,
): ModuleKey | null {
  if (isModuleGuardExempt(pathname)) return null;
  const moduleKey = resolveModuleForPath(pathname);
  if (!moduleKey) return null;
  const modules = effectiveModules ?? resolveEffectiveModules(allModulesAdminEnabled());
  if (modules[moduleKey]) return null;
  return moduleKey;
}

/** Use in API route handlers when module cannot be inferred from path alone. */
export function requireModule(
  module: ModuleKey,
  effectiveModules?: Record<ModuleKey, boolean>,
): NextResponse | null {
  const modules = effectiveModules ?? resolveEffectiveModules(allModulesAdminEnabled());
  if (modules[module]) return null;
  return NextResponse.json(moduleAccessDeniedPayload(module), { status: 403 });
}

export function moduleUnavailableRedirectUrl(module: ModuleKey, fromPath: string): string {
  const params = new URLSearchParams({ module, from: fromPath });
  return `/dashboard/module-unavailable?${params.toString()}`;
}
