/**
 * Commercial module licensing — each dedicated deployment enables/disables modules via env.
 * Unset or empty env vars default to enabled (full product). Set MODULE_*=false to disable.
 * Demo/sales deployments (DEMO_MODE) always license every module for the full platform story.
 *
 * Company Setup `moduleAdminFlags` can hide licensed modules without redeploying.
 * Effective visibility = licensed (env) AND enabled (admin).
 *
 * Module keys and catalog rows are derived from module-registry.ts (MOD-01).
 */

import { isDemoMode, isPublicDemoMode } from '@/lib/deployment-flags';
import { MODULE_DEFINITIONS, type ModuleKey, type ModulePhase } from '@/lib/module-catalog';
import {
  buildModuleUiGroups,
  MODULE_UI_GROUPS,
  type ModuleUiGroup,
} from '@/lib/module-registry';

export type { ModuleKey, ModulePhase };
export type { ModuleDefinition } from '@/lib/module-catalog';
export { MODULE_DEFINITIONS, buildModuleUiGroups, MODULE_UI_GROUPS, type ModuleUiGroup };

/** Cookie synced from deployment config so middleware can enforce admin module toggles. */
export const MODULE_ADMIN_COOKIE = 'hris_module_prefs';

const MODULE_BY_KEY = Object.fromEntries(MODULE_DEFINITIONS.map((m) => [m.key, m])) as Record<
  ModuleKey,
  (typeof MODULE_DEFINITIONS)[number]
>;

function parseBoolean(v: string | undefined, defaultValue: boolean): boolean {
  if (v === undefined || v === '') return defaultValue;
  const n = v.trim().toLowerCase();
  if (n === '1' || n === 'true' || n === 'yes' || n === 'on') return true;
  if (n === '0' || n === 'false' || n === 'no' || n === 'off') return false;
  return defaultValue;
}

/** All admin toggles on — used when migrating saved company setup without moduleAdminFlags. */
export function allModulesAdminEnabled(): Record<ModuleKey, boolean> {
  return MODULE_DEFINITIONS.reduce(
    (acc, def) => {
      acc[def.key] = true;
      return acc;
    },
    {} as Record<ModuleKey, boolean>,
  );
}

/** Defaults for new deployments: HR + Finance on; vertical engines off. */
export function defaultModuleAdminFlags(): Record<ModuleKey, boolean> {
  return MODULE_DEFINITIONS.reduce(
    (acc, def) => {
      if (def.key === 'core' || def.key === 'accounts') acc[def.key] = true;
      else if (
        def.key === 'assets' ||
        def.key === 'fleet' ||
        def.key === 'sacco' ||
        def.key === 'healthcare' ||
        def.key === 'energy' ||
        def.key === 'construction'
      )
        acc[def.key] = false;
      else acc[def.key] = true;
      return acc;
    },
    {} as Record<ModuleKey, boolean>,
  );
}

/** Preset: hide non-HR extended modules (Recruitment, vertical engines). */
export function hrEssentialsModuleAdminFlags(
  current: Record<ModuleKey, boolean>,
): Record<ModuleKey, boolean> {
  return {
    ...current,
    accounts: true,
    assets: false,
    ats: false,
    fleet: false,
    sacco: false,
    healthcare: false,
    energy: false,
    construction: false,
    sales: false,
    outsourcing: false,
    projects: false,
    operations: false,
    assessments: false,
  };
}

export function sanitizeModuleAdminFlags(value: unknown): Record<ModuleKey, boolean> {
  if (!value || typeof value !== 'object') return allModulesAdminEnabled();
  const raw = value as Record<string, unknown>;
  return MODULE_DEFINITIONS.reduce(
    (acc, def) => {
      if (!def.canDisable) {
        acc[def.key] = true;
        return acc;
      }
      const v = raw[def.key];
      acc[def.key] = typeof v === 'boolean' ? v : true;
      return acc;
    },
    {} as Record<ModuleKey, boolean>,
  );
}

/** Env / deployment license — cannot be overridden from Company Setup. */
export function isModuleLicensed(key: ModuleKey): boolean {
  const def = MODULE_BY_KEY[key];
  if (!def.canDisable) return true;
  if (isDemoMode() || isPublicDemoMode()) return true;
  return parseBoolean(process.env[def.envVar], true);
}

export function listLicensedModules(): Record<ModuleKey, boolean> {
  return MODULE_DEFINITIONS.reduce(
    (acc, def) => {
      acc[def.key] = isModuleLicensed(def.key);
      return acc;
    },
    {} as Record<ModuleKey, boolean>,
  );
}

export type SubscriptionEntitlements = {
  /** Control-plane subscription modules. Undefined = no subscription sync (env-only). */
  subscribedModules?: Partial<Record<ModuleKey, boolean>>;
  accountStatus?: string;
  verticalEnginesAllowed?: boolean;
};

function isAccountBlocked(status: string | undefined): boolean {
  return status === 'suspended' || status === 'churned';
}

function isSubscribed(
  key: ModuleKey,
  subscribed: Partial<Record<ModuleKey, boolean>> | undefined,
): boolean {
  if (!subscribed) return true;
  if (key === 'core') return subscribed.core !== false;
  if (key === 'accounts') return subscribed.accounts !== false;
  if (subscribed[key] === true) return true;
  if (key === 'legal' && subscribed.documents === true) return true;
  if (key === 'documents' && subscribed.legal === true) return true;
  return false;
}

/** Fail-closed module map when control plane sync is configured but org cache is missing. */
export function foundationalModulesOnly(): Partial<Record<ModuleKey, boolean>> {
  return MODULE_DEFINITIONS.reduce(
    (acc, def) => {
      if (!def.canDisable || def.key === 'accounts') {
        acc[def.key] = true;
      } else if (def.key === 'ess') {
        acc[def.key] = true;
      } else {
        acc[def.key] = false;
      }
      return acc;
    },
    {} as Partial<Record<ModuleKey, boolean>>,
  );
}

/** Merge deployment license with Company Setup admin toggles and subscription entitlements. */
export function resolveEffectiveModules(
  adminFlags: Record<ModuleKey, boolean>,
  subscription?: SubscriptionEntitlements,
): Record<ModuleKey, boolean> {
  const licensed = listLicensedModules();
  const blocked = isAccountBlocked(subscription?.accountStatus);

  return MODULE_DEFINITIONS.reduce(
    (acc, def) => {
      if (blocked) {
        acc[def.key] = false;
        return acc;
      }

      const envOk = licensed[def.key];
      const entitled = isSubscribed(def.key, subscription?.subscribedModules);
      const verticalOk =
        def.key !== 'fleet' &&
        def.key !== 'assets' &&
        def.key !== 'hse' &&
        def.key !== 'sacco' &&
        def.key !== 'healthcare' &&
        def.key !== 'energy' &&
        def.key !== 'construction'
          ? true
          : subscription?.verticalEnginesAllowed !== false;

      const adminOk =
        !def.canDisable || def.key === 'core' || def.key === 'accounts'
          ? true
          : adminFlags[def.key] !== false;

      acc[def.key] = envOk && entitled && verticalOk && adminOk;
      return acc;
    },
    {} as Record<ModuleKey, boolean>,
  );
}

/** @deprecated Use isModuleLicensed or resolveEffectiveModules. Env license only. */
export function isModuleEnabled(key: ModuleKey): boolean {
  return isModuleLicensed(key);
}

/** @deprecated Use resolveEffectiveModules with admin flags. Env license only. */
export function listEnabledModules(): Record<ModuleKey, boolean> {
  return listLicensedModules();
}

export function getModuleDefinition(key: ModuleKey): (typeof MODULE_DEFINITIONS)[number] {
  return MODULE_BY_KEY[key];
}

/** Human-readable label for error messages and UI. */
export function getModuleLabel(key: ModuleKey): string {
  return MODULE_BY_KEY[key]?.label ?? key;
}
