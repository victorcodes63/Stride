import { describe, expect, it } from 'vitest';
import {
  buildProvisioningChecklist,
  DEFAULT_COMPANY_SETUP,
  getEffectiveOAuthProviders,
  sanitizeCompanySetup,
} from '@/lib/company-setup';
import { defaultModuleAdminFlags } from '@/lib/modules';

describe('company-setup', () => {
  it('sanitizes partial payloads with defaults', () => {
    const result = sanitizeCompanySetup({ staffEnableGoogleLogin: false, primaryColor: '#FF0000' });
    expect(result.staffEnableGoogleLogin).toBe(false);
    expect(result.primaryColor).toBe('#FF0000');
    expect(result.dashboardTableZebraStriping).toBe(true);
    expect(result.sensitiveActionReauthEnabled).toBe(false);
    expect(result.sensitiveActionReauthUserIds).toEqual([]);
  });

  it('filters oauth providers by auth method', () => {
    const setup = sanitizeCompanySetup({
      staffAuthMethod: 'microsoft',
    });
    const providers = getEffectiveOAuthProviders('staff', setup);
    expect(providers).toHaveLength(1);
    expect(providers[0]?.key).toBe('microsoft');
  });

  it('builds provisioning checklist', () => {
    const items = buildProvisioningChecklist(DEFAULT_COMPANY_SETUP);
    expect(items.length).toBeGreaterThan(5);
    expect(items.some((i) => i.id === 'org-name')).toBe(true);
  });

  it('defaults moduleAdminFlags with finance and assets off for fresh setup', () => {
    const flags = defaultModuleAdminFlags();
    expect(flags.accounts).toBe(false);
    expect(flags.assets).toBe(false);
    expect(flags.core).toBe(true);
  });

  it('migrates missing moduleAdminFlags to all enabled', () => {
    const result = sanitizeCompanySetup({ appName: 'Test Co' });
    expect(result.moduleAdminFlags.accounts).toBe(true);
    expect(result.moduleAdminFlags.core).toBe(true);
  });
});
