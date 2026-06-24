import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canAccessCompanySetup,
  COMPANY_SETUP_TIERS,
  getDeploymentTier,
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

  it('starter tier cannot access company setup', () => {
    vi.stubEnv('DEMO_MODE', 'false');
    vi.stubEnv('DEPLOYMENT_TIER', 'starter');
    expect(canAccessCompanySetup()).toBe(false);
  });

  it('growth and enterprise tiers can access company setup', () => {
    vi.stubEnv('DEMO_MODE', 'false');
    for (const tier of COMPANY_SETUP_TIERS) {
      vi.stubEnv('DEPLOYMENT_TIER', tier);
      expect(canAccessCompanySetup()).toBe(true);
    }
  });
});
