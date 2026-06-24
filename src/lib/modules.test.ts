import { describe, expect, it } from 'vitest';
import {
  allModulesAdminEnabled,
  defaultModuleAdminFlags,
  hrEssentialsModuleAdminFlags,
  isModuleLicensed,
  listLicensedModules,
  resolveEffectiveModules,
} from '@/lib/modules';

describe('modules', () => {
  it('core module is always licensed', () => {
    const prev = process.env.MODULE_CORE;
    process.env.MODULE_CORE = 'false';
    try {
      expect(isModuleLicensed('core')).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.MODULE_CORE;
      else process.env.MODULE_CORE = prev;
    }
  });

  it('accounts module is always licensed (finance pillar)', () => {
    const prev = process.env.MODULE_ACCOUNTS;
    process.env.MODULE_ACCOUNTS = 'false';
    try {
      expect(isModuleLicensed('accounts')).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.MODULE_ACCOUNTS;
      else process.env.MODULE_ACCOUNTS = prev;
    }
  });

  it('defaults optional modules to licensed when env unset', () => {
    const keys = ['MODULE_ATS', 'MODULE_PAYROLL', 'MODULE_HSE'] as const;
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    for (const k of keys) delete process.env[k];
    try {
      expect(isModuleLicensed('ats')).toBe(true);
      expect(isModuleLicensed('payroll')).toBe(true);
      expect(isModuleLicensed('hse')).toBe(true);
    } finally {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  });

  it('licenses all modules in demo mode even when MODULE_*=false', () => {
    const saved = {
      DEMO_MODE: process.env.DEMO_MODE,
      MODULE_ATS: process.env.MODULE_ATS,
      MODULE_ACCOUNTS: process.env.MODULE_ACCOUNTS,
    };
    process.env.DEMO_MODE = 'true';
    process.env.MODULE_ATS = 'false';
    process.env.MODULE_ACCOUNTS = 'false';
    try {
      expect(isModuleLicensed('ats')).toBe(true);
      expect(isModuleLicensed('accounts')).toBe(true);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it('listLicensedModules returns all module keys', () => {
    const modules = listLicensedModules();
    expect(modules.core).toBe(true);
    expect(Object.keys(modules).length).toBeGreaterThanOrEqual(10);
  });

  it('defaultModuleAdminFlags enables HR and Finance for new deploys', () => {
    const flags = defaultModuleAdminFlags();
    expect(flags.core).toBe(true);
    expect(flags.accounts).toBe(true);
    expect(flags.assets).toBe(false);
    expect(flags.fleet).toBe(false);
    expect(flags.leave).toBe(true);
  });

  it('resolveEffectiveModules requires license and admin toggle', () => {
    const prev = {
      MODULE_ACCOUNTS: process.env.MODULE_ACCOUNTS,
      DEMO_MODE: process.env.DEMO_MODE,
      NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
    };
    delete process.env.DEMO_MODE;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.MODULE_ACCOUNTS = 'true';
    try {
      const adminOn = allModulesAdminEnabled();
      expect(resolveEffectiveModules(adminOn).accounts).toBe(true);

      const adminOff = { ...adminOn, payroll: false };
      expect(resolveEffectiveModules(adminOff).payroll).toBe(false);

      process.env.MODULE_ACCOUNTS = 'false';
      expect(resolveEffectiveModules(adminOn).accounts).toBe(true);
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it('subscription entitlements block unlicensed modules', () => {
    const admin = allModulesAdminEnabled();
    const effective = resolveEffectiveModules(admin, {
      subscribedModules: { fleet: false, accounts: true },
      verticalEnginesAllowed: false,
    });
    expect(effective.fleet).toBe(false);
    expect(effective.accounts).toBe(true);
  });
});
