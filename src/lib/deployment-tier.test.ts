import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canAccessCompanySetup,
  getDeploymentTier,
  resolveDeploymentTier,
} from '@/lib/deployment-tier';

describe('deployment-tier', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to growth when unset', () => {
    vi.stubEnv('DEMO_MODE', 'false');
    vi.stubEnv('DEPLOYMENT_TIER', '');
    expect(getDeploymentTier()).toBe('growth');
  });

  it('demo mode always resolves to enterprise', () => {
    vi.stubEnv('DEMO_MODE', 'true');
    vi.stubEnv('DEPLOYMENT_TIER', 'starter');
    expect(getDeploymentTier()).toBe('enterprise');
    expect(canAccessCompanySetup()).toBe(true);
  });

  it('company setup is always accessible regardless of tier', () => {
    vi.stubEnv('DEMO_MODE', 'false');
    for (const tier of ['starter', 'growth', 'enterprise'] as const) {
      vi.stubEnv('DEPLOYMENT_TIER', tier);
      expect(canAccessCompanySetup()).toBe(true);
    }
  });

  it('resolveDeploymentTier falls back to env when entitlements are unavailable', async () => {
    vi.stubEnv('DEMO_MODE', 'false');
    vi.stubEnv('DEPLOYMENT_TIER', 'enterprise');
    await expect(resolveDeploymentTier()).resolves.toBe('enterprise');
  });
});
