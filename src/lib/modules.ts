/**
 * Commercial module licensing — each dedicated deployment enables/disables modules via env.
 * Unset or empty env vars default to enabled (full product). Set MODULE_*=false to disable.
 * Demo/sales deployments (DEMO_MODE) always license every module for the full platform story.
 *
 * Company Setup `moduleAdminFlags` can hide licensed modules without redeploying.
 * Effective visibility = licensed (env) AND enabled (admin).
 */

import { isDemoMode, isLocalDevAllModules, isPublicDemoMode } from '@/lib/deployment-flags';
import {
  allModulesAdminEnabled,
  MODULE_ADMIN_COOKIE,
  sanitizeModuleAdminFlags,
} from '@/lib/module-admin-flags';
export type { ModuleKey, ModulePhase, ModuleDefinition } from '@/lib/module-catalog';
export { MODULE_DEFINITIONS } from '@/lib/module-catalog';
import type { ModuleKey, ModuleDefinition } from '@/lib/module-catalog';
import { MODULE_DEFINITIONS } from '@/lib/module-catalog';

export { MODULE_ADMIN_COOKIE, sanitizeModuleAdminFlags, allModulesAdminEnabled };

export type ModuleUiGroup = {
  id: string;
  label: string;
  description: string;
  keys: ModuleKey[];
  /** Core HR — toggles disabled in UI */
  locked?: boolean;
};

export const MODULE_UI_GROUPS: ModuleUiGroup[] = [
  {
    id: 'core',
    label: 'Platform base',
    description: 'HR people data and Finance — included on every plan.',
    keys: ['core', 'accounts'],
    locked: true,
  },
  {
    id: 'people-ops',
    label: 'Phase 1 — People & operations',
    description: 'Leave, time, payroll, and day-to-day workforce workflows.',
    keys: ['leave', 'time', 'payroll', 'performance', 'disciplinary', 'ess', 'reports'],
  },
  {
    id: 'workplace',
    label: 'Phase 2 — Workplace',
    description: 'Communications, training, documents, procurement, and legal.',
    keys: ['communications', 'training', 'documents', 'procurement', 'legal'],
  },
  {
    id: 'projects',
    label: 'Project management',
    description: 'Project register, board, tasks, and budget vs actual.',
    keys: ['projects'],
  },
  {
    id: 'extended',
    label: 'Phase 2–3 — Expansion modules',
    description: 'Talent, safety, assets, and vertical engines.',
    keys: ['ats', 'hse', 'assets', 'fleet', 'sacco', 'healthcare', 'energy', 'construction', 'outsourcing'],
  },
];

const MODULE_BY_KEY = Object.fromEntries(MODULE_DEFINITIONS.map((m) => [m.key, m])) as Record<
  ModuleKey,
  ModuleDefinition
>;

function parseBoolean(v: string | undefined, defaultValue: boolean): boolean {
  if (v === undefined || v === '') return defaultValue;
  const n = v.trim().toLowerCase();
  if (n === '1' || n === 'true' || n === 'yes' || n === 'on') return true;
  if (n === '0' || n === 'false' || n === 'no' || n === 'off') return false;
  return defaultValue;
}

/** Defaults for new deployments: HR + Finance on; vertical engines off. */
export function defaultModuleAdminFlags(): Record<ModuleKey, boolean> {
  return MODULE_DEFINITIONS.reduce(
    (acc, def) => {
      if (def.key === 'core' || def.key === 'accounts') acc[def.key] = true;
      else if (
        def.key === 'assets' ||
        def.key === 'fleet' ||
        def.key === 'outsourcing' ||
        def.key === 'operations' ||
        def.key === 'sales' ||
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
    assessments: false,
    outsourcing: false,
    operations: false,
    sales: false,
    fleet: false,
    sacco: false,
    healthcare: false,
    energy: false,
    construction: false,
  };
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
  const effectiveAdminFlags = isLocalDevAllModules() ? allModulesAdminEnabled() : adminFlags;
  const effectiveSubscription =
    isLocalDevAllModules() && subscription
      ? { ...subscription, verticalEnginesAllowed: true }
      : subscription;

  return MODULE_DEFINITIONS.reduce(
    (acc, def) => {
      if (blocked) {
        acc[def.key] = false;
        return acc;
      }

      const envOk = licensed[def.key];
      const entitled =
        isDemoMode() || isPublicDemoMode() || isLocalDevAllModules()
          ? true
          : isSubscribed(def.key, effectiveSubscription?.subscribedModules);
      const verticalOk =
        def.key !== 'fleet' &&
        def.key !== 'assets' &&
        def.key !== 'hse' &&
        def.key !== 'sacco' &&
        def.key !== 'healthcare' &&
        def.key !== 'energy' &&
        def.key !== 'construction'
          ? true
          : effectiveSubscription?.verticalEnginesAllowed !== false;

      const adminOk =
        !def.canDisable || def.key === 'core' || def.key === 'accounts'
          ? true
          : effectiveAdminFlags[def.key] !== false;

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

export function getModuleDefinition(key: ModuleKey): ModuleDefinition {
  return MODULE_BY_KEY[key];
}

/** Human-readable label for error messages and UI. */
export function getModuleLabel(key: ModuleKey): string {
  return MODULE_BY_KEY[key]?.label ?? key;
}
