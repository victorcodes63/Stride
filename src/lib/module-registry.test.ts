import { describe, expect, it } from 'vitest';
import {
  MODULE_BUCKET,
  MODULE_KEYS,
  MODULE_REGISTRY,
  MODULE_UI_GROUPS,
  NAV_SECTION_MODULES,
  getModuleRegistryEntry,
} from '@/lib/module-registry';
import { MODULE_DEFINITIONS } from '@/lib/module-catalog';

const EXPECTED_KEYS = [
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
  'ats',
  'performance',
  'training',
  'procurement',
  'legal',
  'projects',
  'operations',
  'outsourcing',
  'sales',
  'assessments',
  'fleet',
  'assets',
  'hse',
  'sacco',
  'healthcare',
  'energy',
  'construction',
] as const;

describe('module-registry', () => {
  it('covers all 27 capabilities with one row each', () => {
    expect(MODULE_REGISTRY).toHaveLength(27);
    expect([...MODULE_KEYS].sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it('aligns MODULE_DEFINITIONS with the registry', () => {
    expect(MODULE_DEFINITIONS.map((d) => d.key).sort()).toEqual([...MODULE_KEYS].sort());
  });

  it('assigns every capability a MODULE_* env flag and bucket', () => {
    for (const row of MODULE_REGISTRY) {
      expect(row.envVar).toMatch(/^MODULE_[A-Z_]+$/);
      expect(MODULE_BUCKET[row.key]).toBe(row.bucket);
      expect(getModuleRegistryEntry(row.key).key).toBe(row.key);
    }
  });

  it('only references valid requires parents', () => {
    for (const row of MODULE_REGISTRY) {
      for (const parent of row.requires ?? []) {
        expect(MODULE_KEYS).toContain(parent);
      }
    }
  });

  it('groups every module under exactly one Company Setup domain', () => {
    const grouped = MODULE_UI_GROUPS.flatMap((g) => g.keys);
    expect(grouped.sort()).toEqual([...MODULE_KEYS].sort());
    expect(new Set(grouped).size).toBe(MODULE_KEYS.length);
    expect(MODULE_UI_GROUPS.find((g) => g.label.includes('Expansion'))).toBeUndefined();
    const hrGroup = MODULE_UI_GROUPS.find((g) => g.id === 'hr-payroll');
    expect(hrGroup?.keys).toContain('ats');
    expect(hrGroup?.keys).toContain('performance');
  });

  it('derives nav section modules from registry navSectionId', () => {
    expect(NAV_SECTION_MODULES['people-hr']).toContain('core');
    expect(NAV_SECTION_MODULES['people-hr']).toContain('performance');
    expect(NAV_SECTION_MODULES.recruitment).toContain('ats');
    expect(NAV_SECTION_MODULES.recruitment).toContain('assessments');
    expect(NAV_SECTION_MODULES['fleet-monitoring']).toContain('fleet');
  });
});
