import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import {
  enforceCompanySetupTier,
  getCompanySetupCapabilities,
  isCompanySetupAddOn,
} from '@/lib/company-setup-tier-features';
import { DEFAULT_COMPANY_SETUP, type CompanySetupSettings } from '@/lib/company-setup';
import { DEFAULT_PRIMARY_COLOR } from '@/lib/brand-theme';

function settings(overrides: Partial<CompanySetupSettings> = {}): CompanySetupSettings {
  return { ...DEFAULT_COMPANY_SETUP, ...overrides };
}

describe('getCompanySetupCapabilities — tier baseline', () => {
  it('growth unlocks colour + multi-entity but not white-label or custom domain', () => {
    const caps = getCompanySetupCapabilities('growth');
    expect(caps.canConfigureColorScheme).toBe(true);
    expect(caps.canConfigureMultiEntity).toBe(true);
    expect(caps.canConfigureWhiteLabel).toBe(false);
    expect(caps.canConfigureCustomDomain).toBe(false);
    expect(caps.canConfigureDashboardBanner).toBe(false);
    expect(caps.addOns).toEqual([]);
  });

  it('enterprise unlocks everything with no add-on badges', () => {
    const caps = getCompanySetupCapabilities('enterprise');
    expect(caps.canConfigureWhiteLabel).toBe(true);
    expect(caps.canConfigureCustomDomain).toBe(true);
    expect(caps.canConfigureDashboardBanner).toBe(true);
    expect(caps.addOns).toEqual([]);
  });

  it('starter locks colour, white-label, and custom domain', () => {
    const caps = getCompanySetupCapabilities('starter');
    expect(caps.canConfigureColorScheme).toBe(false);
    expect(caps.canConfigureWhiteLabel).toBe(false);
    expect(caps.canConfigureCustomDomain).toBe(false);
    expect(caps.canConfigureMultiEntity).toBe(false);
  });
});

describe('getCompanySetupCapabilities — per-customer add-ons', () => {
  it('white-label add-on on growth unlocks white-label + banner and flags them as add-ons', () => {
    const caps = getCompanySetupCapabilities({ tier: 'growth', features: { whitelabel: true } });
    expect(caps.canConfigureWhiteLabel).toBe(true);
    expect(caps.canConfigureDashboardBanner).toBe(true);
    expect(isCompanySetupAddOn(caps, 'canConfigureWhiteLabel')).toBe(true);
    expect(isCompanySetupAddOn(caps, 'canConfigureDashboardBanner')).toBe(true);
    // Colour scheme is already a growth baseline, so it is not an add-on.
    expect(isCompanySetupAddOn(caps, 'canConfigureColorScheme')).toBe(false);
  });

  it('custom-domain add-on on starter unlocks and flags custom domain', () => {
    const caps = getCompanySetupCapabilities({ tier: 'starter', features: { custom_domain: true } });
    expect(caps.canConfigureCustomDomain).toBe(true);
    expect(isCompanySetupAddOn(caps, 'canConfigureCustomDomain')).toBe(true);
    expect(caps.canConfigureWhiteLabel).toBe(false);
  });

  it('white-label add-on on starter also unlocks colour scheme as an add-on', () => {
    const caps = getCompanySetupCapabilities({ tier: 'starter', features: { whitelabel: true } });
    expect(isCompanySetupAddOn(caps, 'canConfigureColorScheme')).toBe(true);
    expect(isCompanySetupAddOn(caps, 'canConfigureWhiteLabel')).toBe(true);
  });

  it('disabled feature (false) does not unlock a capability', () => {
    const caps = getCompanySetupCapabilities({ tier: 'growth', features: { whitelabel: false } });
    expect(caps.canConfigureWhiteLabel).toBe(false);
  });
});

describe('enforceCompanySetupTier', () => {
  const branded = settings({
    appName: 'Acme HR',
    wordmark: 'Acme',
    hidePoweredBy: true,
    customDomain: 'hr.acme.com',
    primaryColor: '#123456',
  });

  it('strips white-label + custom-domain fields when neither tier nor add-on grants them', () => {
    const caps = getCompanySetupCapabilities('growth');
    const next = enforceCompanySetupTier(branded, caps);
    expect(next.appName).toBe('');
    expect(next.wordmark).toBe('');
    expect(next.hidePoweredBy).toBe(false);
    expect(next.customDomain).toBe('');
    // Colour scheme is allowed on growth, so the custom colour is preserved.
    expect(next.primaryColor).toBe('#123456');
  });

  it('preserves white-label fields when an add-on grants them', () => {
    const caps = getCompanySetupCapabilities({ tier: 'growth', features: { whitelabel: true } });
    const next = enforceCompanySetupTier(branded, caps);
    expect(next.appName).toBe('Acme HR');
    expect(next.wordmark).toBe('Acme');
    expect(next.hidePoweredBy).toBe(true);
    // custom_domain not granted → still stripped.
    expect(next.customDomain).toBe('');
  });

  it('preserves the custom domain when the custom-domain add-on is granted', () => {
    const caps = getCompanySetupCapabilities({ tier: 'growth', features: { custom_domain: true } });
    const next = enforceCompanySetupTier(branded, caps);
    expect(next.customDomain).toBe('hr.acme.com');
  });

  it('resets colours to defaults on starter (no colour scheme)', () => {
    const caps = getCompanySetupCapabilities('starter');
    const next = enforceCompanySetupTier(branded, caps);
    expect(next.primaryColor).toBe(DEFAULT_PRIMARY_COLOR);
  });
});
