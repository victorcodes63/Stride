/**
 * Per–demo-vertical moduleAdminFlags for multi-company industry demos.
 * Env/DEMO_MODE still licenses all modules; these flags drive nav visibility when
 * company context switches (admin.company.setup:${packId}).
 */

import { MODULE_KEYS, type ModuleKey } from '@/lib/module-registry';
import { allModulesAdminEnabled } from '@/lib/modules';

/** Always on for every industry pack (people ops + finance + light horizontals). */
export const DEMO_FOUNDATIONAL_MODULES = [
  'core',
  'ess',
  'leave',
  'time',
  'payroll',
  'disciplinary',
  'accounts',
  'reports',
  'documents',
  'communications',
  'operations',
  'training',
  'legal',
  'ats',
] as const satisfies readonly ModuleKey[];

/** Extra modules ON beyond foundational (Savannah uses allModulesAdminEnabled instead). */
export const DEMO_VERTICAL_EXTRA_MODULES: Record<string, readonly ModuleKey[]> = {
  'imara-sacco': ['performance', 'procurement', 'sacco', 'assets', 'hse'],
  'hospital-healthcare': ['performance', 'procurement', 'assessments', 'healthcare', 'hse', 'assets'],
  'petroleum-retail': ['performance', 'procurement', 'energy', 'hse', 'assets'],
  construction: ['performance', 'procurement', 'projects', 'construction', 'assets', 'hse'],
  'travel-agency': ['performance', 'sales', 'assessments', 'procurement'],
};

function flagsFromAllowlist(on: ReadonlySet<ModuleKey>): Record<ModuleKey, boolean> {
  return MODULE_KEYS.reduce(
    (acc, key) => {
      acc[key] = on.has(key);
      return acc;
    },
    {} as Record<ModuleKey, boolean>,
  );
}

/**
 * Admin flags for a demo pack. Savannah (cargo-logistics) and unknown packs → all on.
 * `generic` shell → foundational only (no vertical engines).
 */
export function getDemoModuleAdminFlags(packId: string): Record<ModuleKey, boolean> {
  const id = packId.trim().toLowerCase();

  if (id === 'cargo-logistics') {
    return allModulesAdminEnabled();
  }

  if (id === 'generic') {
    return flagsFromAllowlist(new Set(DEMO_FOUNDATIONAL_MODULES));
  }

  const extras = DEMO_VERTICAL_EXTRA_MODULES[id];
  if (!extras) {
    return allModulesAdminEnabled();
  }

  return flagsFromAllowlist(new Set<ModuleKey>([...DEMO_FOUNDATIONAL_MODULES, ...extras]));
}
