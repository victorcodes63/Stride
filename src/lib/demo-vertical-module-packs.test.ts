import { describe, expect, it } from 'vitest';
import { MODULE_KEYS } from '@/lib/module-registry';
import { allModulesAdminEnabled } from '@/lib/modules';
import {
  DEMO_FOUNDATIONAL_MODULES,
  DEMO_VERTICAL_EXTRA_MODULES,
  getDemoModuleAdminFlags,
} from '@/lib/demo-vertical-module-packs';

describe('getDemoModuleAdminFlags', () => {
  it('Savannah / cargo-logistics enables every module', () => {
    const flags = getDemoModuleAdminFlags('cargo-logistics');
    expect(flags).toEqual(allModulesAdminEnabled());
    for (const key of MODULE_KEYS) {
      expect(flags[key]).toBe(true);
    }
  });

  it('generic shell keeps foundational only (no vertical engines)', () => {
    const flags = getDemoModuleAdminFlags('generic');
    for (const key of DEMO_FOUNDATIONAL_MODULES) {
      expect(flags[key]).toBe(true);
    }
    expect(flags.fleet).toBe(false);
    expect(flags.sacco).toBe(false);
    expect(flags.outsourcing).toBe(false);
    expect(flags.sales).toBe(false);
  });

  it('Heritage SACCO hides fleet and outsourcing', () => {
    const flags = getDemoModuleAdminFlags('imara-sacco');
    expect(flags.sacco).toBe(true);
    expect(flags.fleet).toBe(false);
    expect(flags.outsourcing).toBe(false);
    expect(flags.sales).toBe(false);
    expect(flags.projects).toBe(false);
    expect(flags.payroll).toBe(true);
  });

  it('Kilimani Builders shows projects + construction, hides fleet', () => {
    const flags = getDemoModuleAdminFlags('construction');
    expect(flags.projects).toBe(true);
    expect(flags.construction).toBe(true);
    expect(flags.fleet).toBe(false);
    expect(flags.sacco).toBe(false);
  });

  it('Horizon Travels hides all industry vertical engines', () => {
    const flags = getDemoModuleAdminFlags('travel-agency');
    expect(flags.sales).toBe(true);
    expect(flags.fleet).toBe(false);
    expect(flags.assets).toBe(false);
    expect(flags.hse).toBe(false);
    expect(flags.sacco).toBe(false);
    expect(flags.healthcare).toBe(false);
    expect(flags.energy).toBe(false);
    expect(flags.construction).toBe(false);
    expect(flags.outsourcing).toBe(false);
    expect(flags.projects).toBe(false);
  });

  it('extra modules for each vertical are a subset of MODULE_KEYS', () => {
    for (const [packId, extras] of Object.entries(DEMO_VERTICAL_EXTRA_MODULES)) {
      const flags = getDemoModuleAdminFlags(packId);
      for (const key of extras) {
        expect(MODULE_KEYS.includes(key)).toBe(true);
        expect(flags[key]).toBe(true);
      }
    }
  });
});
