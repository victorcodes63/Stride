import { describe, expect, it } from 'vitest';
import {
  MODULE_BUCKET,
  MODULE_KEYS,
  MODULE_REGISTRY,
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
});
