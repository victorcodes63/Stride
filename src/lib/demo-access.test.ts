import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDemoAccessRows,
  isDemoAccessPageEnabled,
  isInternalDemoSandboxAdvertised,
} from './demo-access';

describe('demo-access (RAV-169 internal-only demo)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not advertise sandbox on public deploys by default', () => {
    expect(isInternalDemoSandboxAdvertised()).toBe(false);
    expect(isDemoAccessPageEnabled()).toBe(false);
  });

  it('enables demo-access only with explicit internal flag off marketing', () => {
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_DEMO_SANDBOX', 'true');
    vi.stubEnv('NEXT_PUBLIC_TENANT_LOGIN_BRANDING', 'true');
    expect(isInternalDemoSandboxAdvertised()).toBe(true);
    expect(isDemoAccessPageEnabled()).toBe(true);
  });

  it('blocks demo-access on marketing domain even with internal flag', () => {
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_DEMO_SANDBOX', 'true');
    vi.stubEnv('NEXT_PUBLIC_MARKETING_DOMAIN', 'getstride.co.ke');
    vi.stubEnv('NEXT_PUBLIC_GENERIC_PUBLIC_LOGIN', 'true');
    expect(isDemoAccessPageEnabled()).toBe(false);
  });

  it('returns demo rows for internal tooling page', () => {
    const rows = getDemoAccessRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('email');
  });
});
