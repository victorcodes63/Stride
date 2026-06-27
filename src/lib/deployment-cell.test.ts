import { afterEach, describe, expect, it } from 'vitest';
import {
  envTenantDisplayName,
  GENERIC_ORG_PLACEHOLDER,
  isCustomerProductionCell,
  isDemoSandboxCell,
  resolveTenantDisplayName,
} from '@/lib/deployment-cell';

const ENV_KEYS = [
  'DEMO_MODE',
  'DEMO_PACK',
  'NEXT_PUBLIC_DEMO_MODE',
  'NEXT_PUBLIC_ORG_NAME',
  'PROVISION_ORG_NAME',
] as const;

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe('deployment-cell', () => {
  afterEach(clearEnv);

  it('treats DEMO_MODE + DEMO_PACK as demo sandbox', () => {
    process.env.DEMO_MODE = 'true';
    process.env.DEMO_PACK = 'cargo-logistics';
    process.env.NEXT_PUBLIC_ORG_NAME = 'SwiftFreight East Africa Ltd';
    expect(isDemoSandboxCell()).toBe(true);
    expect(isCustomerProductionCell()).toBe(false);
    expect(envTenantDisplayName()).toBe('SwiftFreight East Africa Ltd');
  });

  it('treats customer cell without demo pack as production', () => {
    process.env.DEMO_MODE = 'true';
    process.env.NEXT_PUBLIC_ORG_NAME = 'SwiftFreight East Africa Ltd';
    expect(isDemoSandboxCell()).toBe(false);
    expect(isCustomerProductionCell()).toBe(true);
    expect(envTenantDisplayName()).toBeNull();
  });

  it('prefers organization name over env on customer cell', () => {
    process.env.NEXT_PUBLIC_ORG_NAME = 'SwiftFreight East Africa Ltd';
    expect(resolveTenantDisplayName('Raven Tech Group')).toBe('Raven Tech Group');
  });

  it('falls back to generic placeholder when no org name on customer cell', () => {
    expect(resolveTenantDisplayName(null)).toBe(GENERIC_ORG_PLACEHOLDER);
  });
});
