import { MODULE_DEFINITIONS, type ModuleKey } from '@/lib/module-catalog';
import { enforceDependencyClosure } from '@/lib/module-dependencies';

export const MODULE_ADMIN_COOKIE = 'hris_module_prefs';

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

export function sanitizeModuleAdminFlags(value: unknown): Record<ModuleKey, boolean> {
  if (!value || typeof value !== 'object') return allModulesAdminEnabled();
  const raw = value as Record<string, unknown>;
  return enforceDependencyClosure(
    MODULE_DEFINITIONS.reduce(
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
    ),
  );
}
