/**
 * MOD-04 (RAV-288): Module dependency graph — requires[] auto-disable and validation.
 */

import { MODULE_DEFINITIONS } from '@/lib/module-catalog';
import type { ModuleKey } from '@/lib/module-catalog';
import { MODULE_REGISTRY, getModuleRegistryEntry } from '@/lib/module-registry';

const DEPENDENTS_BY_KEY: Record<ModuleKey, ModuleKey[]> = MODULE_REGISTRY.reduce(
  (acc, row) => {
    for (const parent of row.requires ?? []) {
      acc[parent] = [...(acc[parent] ?? []), row.key];
    }
    return acc;
  },
  {} as Record<ModuleKey, ModuleKey[]>,
);

/** Direct requires parents for a module. */
export function getModuleRequires(key: ModuleKey): readonly ModuleKey[] {
  return getModuleRegistryEntry(key).requires ?? [];
}

/** Modules that directly list `key` in requires[]. */
export function getModuleDependents(key: ModuleKey): readonly ModuleKey[] {
  return DEPENDENTS_BY_KEY[key] ?? [];
}

/** All modules that transitively depend on `key` (children, grandchildren, …). */
export function getTransitiveDependents(key: ModuleKey): ModuleKey[] {
  const seen = new Set<ModuleKey>();
  const queue = [...getModuleDependents(key)];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...getModuleDependents(current));
  }
  return [...seen];
}

/** Parents that must be on before `key` can be enabled. */
export function getDisabledRequiredParents(
  key: ModuleKey,
  flags: Record<ModuleKey, boolean>,
): ModuleKey[] {
  return getModuleRequires(key).filter((parent) => flags[parent] !== true);
}

export type ModuleDependencyIssue = {
  module: ModuleKey;
  missingParents: ModuleKey[];
};

/** Modules enabled without their requires[] parents satisfied. */
export function findDependencyViolations(
  flags: Record<ModuleKey, boolean>,
): ModuleDependencyIssue[] {
  const issues: ModuleDependencyIssue[] = [];
  for (const def of MODULE_DEFINITIONS) {
    if (!flags[def.key]) continue;
    const missingParents = getDisabledRequiredParents(def.key, flags);
    if (missingParents.length > 0) {
      issues.push({ module: def.key, missingParents });
    }
  }
  return issues;
}

/** Disable children when a parent is turned off. */
export function cascadeDisableDependents(
  key: ModuleKey,
  flags: Record<ModuleKey, boolean>,
): Record<ModuleKey, boolean> {
  const next = { ...flags, [key]: false };
  for (const dependent of getTransitiveDependents(key)) {
    const def = MODULE_DEFINITIONS.find((d) => d.key === dependent);
    if (def?.canDisable) next[dependent] = false;
  }
  return next;
}

/** Turn off any enabled module whose requires[] parent is off. */
export function enforceDependencyClosure(
  flags: Record<ModuleKey, boolean>,
): Record<ModuleKey, boolean> {
  const next = { ...flags };
  let changed = true;
  while (changed) {
    changed = false;
    for (const def of MODULE_DEFINITIONS) {
      if (!next[def.key]) continue;
      for (const parent of def.requires ?? []) {
        if (!next[parent]) {
          next[def.key] = false;
          changed = true;
          break;
        }
      }
    }
  }
  return next;
}
