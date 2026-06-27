import { describe, expect, it } from 'vitest';
import {
  applyAuthMethodToSetup,
  authMethodToLegacyFlags,
  getPortalAuthMethod,
  migrateLegacyAuthBooleans,
  syncAuthMethodFields,
} from '@/lib/company-setup-auth';
import { DEFAULT_COMPANY_SETUP, getEffectiveOAuthProviders, sanitizeCompanySetup } from '@/lib/company-setup';

describe('company-setup-auth', () => {
  it('maps auth method to exclusive legacy flags', () => {
    expect(authMethodToLegacyFlags('microsoft')).toEqual({
      enableMicrosoft: true,
      enableGoogle: false,
      enableEmail: false,
    });
    expect(authMethodToLegacyFlags('credentials')).toEqual({
      enableMicrosoft: false,
      enableGoogle: false,
      enableEmail: true,
    });
  });

  it('migrates ambiguous legacy toggles to credentials when SSO not configured', () => {
    expect(
      migrateLegacyAuthBooleans(
        { enableMicrosoft: true, enableGoogle: true, enableEmail: true },
        { microsoft: false, google: false },
      ),
    ).toBe('credentials');
  });

  it('prefers microsoft when legacy had all three and MS is configured', () => {
    expect(
      migrateLegacyAuthBooleans(
        { enableMicrosoft: true, enableGoogle: true, enableEmail: true },
        { microsoft: true, google: false },
      ),
    ).toBe('microsoft');
  });

  it('syncs explicit auth method fields on sanitize', () => {
    const result = sanitizeCompanySetup({
      staffAuthMethod: 'google',
      essAuthMethod: 'credentials',
    });
    expect(result.staffAuthMethod).toBe('google');
    expect(result.staffEnableGoogleLogin).toBe(true);
    expect(result.staffEnableMicrosoftLogin).toBe(false);
    expect(result.staffEnableEmailLogin).toBe(false);
    expect(result.essEnableEmailLogin).toBe(true);
  });
});

describe('company-setup oauth providers', () => {
  it('returns only the active SSO provider for staff', () => {
    const setup = syncAuthMethodFields(
      applyAuthMethodToSetup({ ...DEFAULT_COMPANY_SETUP }, 'staff', 'microsoft'),
    );
    const providers = getEffectiveOAuthProviders('staff', setup);
    expect(providers).toHaveLength(1);
    expect(providers[0]?.key).toBe('microsoft');
  });

  it('returns no oauth providers when credentials is selected', () => {
    const setup = syncAuthMethodFields(
      applyAuthMethodToSetup({ ...DEFAULT_COMPANY_SETUP }, 'staff', 'credentials'),
    );
    expect(getEffectiveOAuthProviders('staff', setup)).toHaveLength(0);
  });

  it('filters oauth providers by company toggles via auth method', () => {
    const setup = sanitizeCompanySetup({
      staffAuthMethod: 'microsoft',
      staffEnableGoogleLogin: false,
    });
    const providers = getEffectiveOAuthProviders('staff', setup);
    expect(providers.find((p) => p.key === 'microsoft')?.enabled).toBe(true);
    expect(providers.find((p) => p.key === 'google')).toBeUndefined();
  });
});
