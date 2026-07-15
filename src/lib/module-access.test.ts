import { describe, expect, it } from 'vitest';
import {
  getBlockedModuleForPath,
  getEffectiveModulesFromRequest,
  getSubscriptionFromRequest,
  isPathAllowedByModuleLicense,
  moduleAccessDeniedPayload,
} from '@/lib/module-access';
import { allModulesAdminEnabled } from '@/lib/modules';
import { ENTITLEMENTS_COOKIE, entitlementsSetCookieHeader } from '@/lib/entitlements-cookie';
import type { NextRequest } from 'next/server';

function requestWithCookies(cookies: Record<string, string>): NextRequest {
  return {
    cookies: {
      get(name: string) {
        const value = cookies[name];
        return value == null ? undefined : { name, value };
      },
    },
  } as NextRequest;
}

function entitlementsCookieValue(modules: Record<string, boolean>): string {
  const header = entitlementsSetCookieHeader({
    slug: 'stride-demo',
    accountStatus: 'active',
    planId: 'enterprise',
    seatLimit: null,
    periodEnd: null,
    modules,
    features: {},
    horizontalQuota: 4,
    verticalEnginesAllowed: true,
    syncedAt: new Date().toISOString(),
  });
  const prefix = `${ENTITLEMENTS_COOKIE}=`;
  const start = header.indexOf(prefix) + prefix.length;
  const end = header.indexOf(';', start);
  return header.slice(start, end === -1 ? undefined : end);
}

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
      expect(getBlockedModuleForPath('/api/payroll')).toBe('payroll');
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it('blocks outsourcing when MODULE_OUTSOURCING=false', () => {
    const prev = {
      MODULE_OUTSOURCING: process.env.MODULE_OUTSOURCING,
      DEMO_MODE: process.env.DEMO_MODE,
      NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
    };
    process.env.MODULE_OUTSOURCING = 'false';
    delete process.env.DEMO_MODE;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    try {
      expect(isPathAllowedByModuleLicense('/dashboard/outsourcing')).toBe(false);
      expect(getBlockedModuleForPath('/api/outsourcing/clients')).toBe('outsourcing');
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

  it('ignores stale entitlements module map on demo cells (sales cookie gap)', () => {
    const prev = {
      DEMO_MODE: process.env.DEMO_MODE,
      NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
      DEMO_PACK: process.env.DEMO_PACK,
    };
    process.env.DEMO_MODE = 'true';
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
    process.env.DEMO_PACK = 'cargo-logistics';
    try {
      const request = requestWithCookies({
        [ENTITLEMENTS_COOKIE]: entitlementsCookieValue({
          core: true,
          accounts: true,
          // sales intentionally absent — pre-MOD-01 control-plane snapshot
        }),
      });
      const subscription = getSubscriptionFromRequest(request);
      expect(subscription?.subscribedModules).toBeUndefined();
      expect(getEffectiveModulesFromRequest(request).sales).toBe(true);
      expect(getBlockedModuleForPath('/dashboard/sales', getEffectiveModulesFromRequest(request))).toBeNull();
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it('honours entitlements module map on non-demo cells', () => {
    const prev = {
      DEMO_MODE: process.env.DEMO_MODE,
      NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
      DEMO_PACK: process.env.DEMO_PACK,
      LOCAL_DEV_ALL_MODULES: process.env.LOCAL_DEV_ALL_MODULES,
    };
    delete process.env.DEMO_MODE;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    delete process.env.DEMO_PACK;
    delete process.env.LOCAL_DEV_ALL_MODULES;
    try {
      const request = requestWithCookies({
        [ENTITLEMENTS_COOKIE]: entitlementsCookieValue({
          core: true,
          accounts: true,
        }),
      });
      expect(getSubscriptionFromRequest(request)?.subscribedModules?.sales).toBeUndefined();
      expect(getEffectiveModulesFromRequest(request).sales).toBe(false);
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
