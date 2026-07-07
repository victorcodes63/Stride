/**
 * MOD-07 (RAV-291): HR domain presets for Company Setup and control plane.
 */

import type { ModuleKey } from '@/lib/module-catalog';
import { MODULE_REGISTRY } from '@/lib/module-registry';
import { cascadeDisableDependents, enforceDependencyClosure } from '@/lib/module-dependencies';

export type HrDomainPresetId = 'hr-essentials' | 'hr-talent' | 'full-hr';

export type HrDomainPreset = {
  id: HrDomainPresetId;
  label: string;
  description: string;
  /** HR-domain modules turned on by this preset. */
  enable: readonly ModuleKey[];
};

/** HR & Payroll domain module keys — sourced from registry domainId. */
export const HR_PAYROLL_MODULE_KEYS: ModuleKey[] = MODULE_REGISTRY.filter(
  (row) => row.domainId === 'hr-payroll',
).map((row) => row.key);

/** Optional HR horizontal add-ons — horizontal quota applies here only (MOD-07). */
export const HR_OPTIONAL_HORIZONTAL_KEYS: ModuleKey[] = MODULE_REGISTRY.filter(
  (row) => row.domainId === 'hr-payroll' && row.bucket === 'horizontal',
).map((row) => row.key);

const HR_ESSENTIALS: ModuleKey[] = [
  'core',
  'leave',
  'time',
  'payroll',
  'ess',
  'disciplinary',
  'reports',
  'communications',
];

const HR_TALENT_ADD: ModuleKey[] = ['ats', 'assessments'];

const FULL_HR_ADD: ModuleKey[] = ['ats', 'assessments', 'performance', 'training', 'sales'];

export const HR_DOMAIN_PRESETS: readonly HrDomainPreset[] = [
  {
    id: 'hr-essentials',
    label: 'HR Essentials',
    description: 'People, leave, time, payroll, ESS, disciplinary, reports and communications.',
    enable: HR_ESSENTIALS,
  },
  {
    id: 'hr-talent',
    label: 'HR + Talent',
    description: 'HR Essentials plus recruitment and candidate assessments.',
    enable: [...HR_ESSENTIALS, ...HR_TALENT_ADD],
  },
  {
    id: 'full-hr',
    label: 'Full HR',
    description:
      'HR Essentials plus recruitment, assessments, performance management, training and sales KPIs.',
    enable: [...HR_ESSENTIALS, ...FULL_HR_ADD],
  },
] as const;

/** Apply an HR preset — keeps non-HR flags unchanged; hides vertical industry packs. */
export function applyHrDomainPreset(
  presetId: HrDomainPresetId,
  current: Record<ModuleKey, boolean>,
): Record<ModuleKey, boolean> {
  const preset = HR_DOMAIN_PRESETS.find((p) => p.id === presetId);
  if (!preset) return current;

  const enableSet = new Set(preset.enable);
  const next = { ...current };

  for (const key of HR_PAYROLL_MODULE_KEYS) {
    const row = MODULE_REGISTRY.find((r) => r.key === key);
    if (!row?.canDisable) {
      next[key] = true;
      continue;
    }
    next[key] = enableSet.has(key);
  }

  for (const key of ['fleet', 'outsourcing', 'operations', 'assets', 'sacco', 'healthcare', 'energy', 'construction'] as const) {
    const row = MODULE_REGISTRY.find((r) => r.key === key);
    if (row?.canDisable) next[key] = false;
  }

  return enforceDependencyClosure(next);
}

/** @deprecated Use applyHrDomainPreset('hr-essentials', …) */
export function hrEssentialsModuleAdminFlags(
  current: Record<ModuleKey, boolean>,
): Record<ModuleKey, boolean> {
  return applyHrDomainPreset('hr-essentials', current);
}

export function countHrOptionalHorizontalModules(
  modules: Record<ModuleKey, boolean>,
): number {
  return HR_OPTIONAL_HORIZONTAL_KEYS.filter((key) => modules[key] === true).length;
}
