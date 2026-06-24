import { describe, expect, it } from 'vitest';

import {
  GLOBAL_PRISMA_MODELS,
  MODULE_MIGRATION_TRACKING,
  MODULE_PRISMA_MODELS,
  apiPrefixesForModule,
  migrationRecordFor,
} from '@/lib/module-migration-registry';
import { MODULE_DEFINITIONS } from '@/lib/modules';

describe('module-migration-registry', () => {
  it('covers every licensed module key', () => {
    for (const def of MODULE_DEFINITIONS) {
      expect(MODULE_PRISMA_MODELS[def.key]).toBeDefined();
      expect(migrationRecordFor(def.key)).toBeDefined();
    }
  });

  it('tracks the same modules as MODULE_DEFINITIONS', () => {
    expect(MODULE_MIGRATION_TRACKING.map((r) => r.module).sort()).toEqual(
      MODULE_DEFINITIONS.map((d) => d.key).sort(),
    );
  });

  it('excludes global identity models from tenant scope', () => {
    expect(GLOBAL_PRISMA_MODELS.has('User')).toBe(true);
    expect(GLOBAL_PRISMA_MODELS.has('CountryConfig')).toBe(true);
    expect(GLOBAL_PRISMA_MODELS.has('Employee')).toBe(false);
  });

  it('returns API prefixes for core module', () => {
    const prefixes = apiPrefixesForModule('core');
    expect(prefixes.some((p) => p.startsWith('/api/outsourcing/employees'))).toBe(true);
  });
});
