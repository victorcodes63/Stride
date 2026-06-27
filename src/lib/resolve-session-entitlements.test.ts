import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/deployment-cell', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/deployment-cell')>();
  return {
    ...actual,
    isCustomerProductionCell: () => true,
    isDemoSandboxCell: () => false,
  };
});

vi.mock('@/lib/entitlements-resolver', () => ({
  isControlPlaneSyncConfigured: () => true,
  fetchEntitlementsFromControlPlane: vi.fn(),
}));

vi.mock('@/lib/org-entitlements-store', () => ({
  loadOrganizationEntitlements: vi.fn(),
  saveOrganizationEntitlements: vi.fn(),
}));

vi.mock('@/lib/entitlements-store', () => ({
  loadDeploymentEntitlements: vi.fn(),
}));

import { fetchEntitlementsFromControlPlane } from '@/lib/entitlements-resolver';
import { loadOrganizationEntitlements } from '@/lib/org-entitlements-store';
import {
  foundationalModulesOnly,
  subscriptionFromEntitlements,
} from '@/lib/resolve-session-entitlements';

describe('subscriptionFromEntitlements', () => {
  it('denies optional modules when entitlements missing on customer cell', () => {
    const sub = subscriptionFromEntitlements(null);
    expect(sub?.subscribedModules?.ats).toBe(false);
    expect(sub?.subscribedModules?.core).toBe(true);
  });

  it('honours explicit entitlements payload', () => {
    const sub = subscriptionFromEntitlements({
      slug: 'raven',
      accountStatus: 'active',
      planId: 'growth',
      seatLimit: 10,
      periodEnd: null,
      modules: { core: true, ats: false },
      features: {},
      horizontalQuota: 4,
      verticalEnginesAllowed: true,
      syncedAt: new Date().toISOString(),
    });
    expect(sub?.subscribedModules?.ats).toBe(false);
  });
});

describe('foundationalModulesOnly', () => {
  it('keeps recruitment off by default', () => {
    expect(foundationalModulesOnly().ats).toBe(false);
  });
});

describe('resolveSessionEntitlements sync', () => {
  it('refreshes stale org entitlements from control plane', async () => {
    const { resolveSessionEntitlements } = await import('@/lib/resolve-session-entitlements');
    const { saveOrganizationEntitlements } = await import('@/lib/org-entitlements-store');

    vi.mocked(loadOrganizationEntitlements).mockResolvedValueOnce({
      slug: 'raven',
      accountStatus: 'active',
      planId: 'growth',
      seatLimit: 10,
      periodEnd: null,
      modules: { ats: true },
      features: {},
      horizontalQuota: 4,
      verticalEnginesAllowed: true,
      syncedAt: '2020-01-01T00:00:00.000Z',
    });

    vi.mocked(fetchEntitlementsFromControlPlane).mockResolvedValueOnce({
      slug: 'raven',
      accountStatus: 'active',
      planId: 'growth',
      seatLimit: 10,
      periodEnd: null,
      modules: { ats: false, core: true },
      features: {},
      horizontalQuota: 4,
      verticalEnginesAllowed: true,
      syncedAt: new Date().toISOString(),
    });

    const result = await resolveSessionEntitlements('org-raven');
    expect(result?.modules.ats).toBe(false);
    expect(saveOrganizationEntitlements).toHaveBeenCalled();
  });
});
