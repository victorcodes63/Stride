import { describe, expect, it } from 'vitest';
import {
  findModuleAdminViolations,
  isModuleEntitled,
} from '@/lib/entitlements-guard';
import type { DeploymentEntitlements } from '@/lib/entitlements-types';

const baseEntitlements: DeploymentEntitlements = {
  slug: 'beta',
  accountStatus: 'active',
  planId: 'starter',
  seatLimit: 25,
  periodEnd: null,
  modules: { fleet: false, procurement: false, accounts: true, core: true },
  features: {},
  horizontalQuota: 2,
  verticalEnginesAllowed: false,
  syncedAt: new Date().toISOString(),
};

describe('entitlements-guard', () => {
  it('allows all modules when no subscription cache', () => {
    expect(isModuleEntitled('fleet', null)).toBe(true);
  });

  it('blocks unentitled modules', () => {
    expect(isModuleEntitled('fleet', baseEntitlements)).toBe(false);
    expect(isModuleEntitled('accounts', baseEntitlements)).toBe(true);
  });

  it('detects admin flag violations', () => {
    const violations = findModuleAdminViolations(
      { fleet: true, accounts: true } as never,
      baseEntitlements,
    );
    expect(violations.map((v) => v.module)).toContain('fleet');
    expect(violations.map((v) => v.module)).not.toContain('accounts');
  });
});
