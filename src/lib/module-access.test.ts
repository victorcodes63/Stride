import { describe, expect, it } from 'vitest';
import {
  getBlockedModuleForPath,
  isPathAllowedByModuleLicense,
  moduleAccessDeniedPayload,
} from '@/lib/module-access';
import { allModulesAdminEnabled } from '@/lib/modules';

describe('module-access', () => {
  it('allows core dashboard paths by default', () => {
    expect(isPathAllowedByModuleLicense('/dashboard/employees')).toBe(true);
    expect(getBlockedModuleForPath('/dashboard/employees')).toBeNull();
  });

  it('allows auth and config paths regardless of modules', () => {
    expect(isPathAllowedByModuleLicense('/api/auth/login')).toBe(true);
    expect(isPathAllowedByModuleLicense('/api/config/deployment')).toBe(true);
    expect(isPathAllowedByModuleLicense('/dashboard/login')).toBe(true);
  });

  it('blocks ATS paths when MODULE_ATS=false', () => {
    const prev = {
      MODULE_ATS: process.env.MODULE_ATS,
      DEMO_MODE: process.env.DEMO_MODE,
      NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
    };
    process.env.MODULE_ATS = 'false';
    delete process.env.DEMO_MODE;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    try {
      expect(isPathAllowedByModuleLicense('/dashboard/jobs')).toBe(false);
      expect(getBlockedModuleForPath('/api/jobs')).toBe('ats');
      expect(moduleAccessDeniedPayload('ats').code).toBe('MODULE_DISABLED');
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it('blocks payroll API when MODULE_PAYROLL=false', () => {
    const prev = {
      MODULE_PAYROLL: process.env.MODULE_PAYROLL,
      DEMO_MODE: process.env.DEMO_MODE,
      NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
    };
    process.env.MODULE_PAYROLL = 'false';
    delete process.env.DEMO_MODE;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    try {
      expect(getBlockedModuleForPath('/api/outsourcing/payroll')).toBe('payroll');
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it('blocks fleet API when MODULE_FLEET=false', () => {
    const prev = {
      MODULE_FLEET: process.env.MODULE_FLEET,
      DEMO_MODE: process.env.DEMO_MODE,
      NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
    };
    process.env.MODULE_FLEET = 'false';
    delete process.env.DEMO_MODE;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    try {
      expect(isPathAllowedByModuleLicense('/dashboard/fleet')).toBe(false);
      expect(getBlockedModuleForPath('/api/fleet/trips')).toBe('fleet');
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it('blocks accounts when admin toggle is off even if licensed', () => {
    const prev = process.env.MODULE_ACCOUNTS;
    process.env.MODULE_ACCOUNTS = 'true';
    try {
      const effective = { ...allModulesAdminEnabled(), accounts: false };
      expect(isPathAllowedByModuleLicense('/dashboard/accounts', effective)).toBe(false);
      expect(getBlockedModuleForPath('/dashboard/accounts', effective)).toBe('accounts');
    } finally {
      if (prev === undefined) delete process.env.MODULE_ACCOUNTS;
      else process.env.MODULE_ACCOUNTS = prev;
    }
  });
});
