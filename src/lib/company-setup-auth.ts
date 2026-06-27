import type { CompanySetupSettings } from '@/lib/company-setup';

/** Exactly one primary sign-in method per portal (staff dashboard or ESS). */
export type PortalAuthMethod = 'microsoft' | 'google' | 'credentials';

export type PortalAudience = 'staff' | 'ess';

export function authMethodToLegacyFlags(method: PortalAuthMethod): {
  enableMicrosoft: boolean;
  enableGoogle: boolean;
  enableEmail: boolean;
} {
  return {
    enableMicrosoft: method === 'microsoft',
    enableGoogle: method === 'google',
    enableEmail: method === 'credentials',
  };
}

export function migrateLegacyAuthBooleans(
  flags: {
    enableMicrosoft: boolean;
    enableGoogle: boolean;
    enableEmail: boolean;
  },
  oauthConfigured?: { microsoft: boolean; google: boolean },
): PortalAuthMethod {
  const { enableMicrosoft, enableGoogle, enableEmail } = flags;
  const count = [enableMicrosoft, enableGoogle, enableEmail].filter(Boolean).length;

  if (count === 1) {
    if (enableMicrosoft) return 'microsoft';
    if (enableGoogle) return 'google';
    return 'credentials';
  }

  if (enableMicrosoft && !enableGoogle && !enableEmail) return 'microsoft';
  if (enableGoogle && !enableMicrosoft && !enableEmail) return 'google';
  if (enableEmail && !enableMicrosoft && !enableGoogle) return 'credentials';

  if (enableMicrosoft && enableGoogle) {
    if (oauthConfigured?.microsoft) return 'microsoft';
    if (oauthConfigured?.google) return 'google';
    return 'credentials';
  }

  if (enableMicrosoft && enableEmail) {
    return oauthConfigured?.microsoft ? 'microsoft' : 'credentials';
  }

  if (enableGoogle && enableEmail) {
    return oauthConfigured?.google ? 'google' : 'credentials';
  }

  if (enableMicrosoft && enableGoogle && enableEmail) {
    if (oauthConfigured?.microsoft) return 'microsoft';
    if (oauthConfigured?.google) return 'google';
    return 'credentials';
  }

  return 'credentials';
}

export function parsePortalAuthMethod(value: unknown): PortalAuthMethod | null {
  if (value === 'microsoft' || value === 'google' || value === 'credentials') return value;
  return null;
}

export function getPortalAuthMethod(
  setup: Pick<
    CompanySetupSettings,
    | 'staffAuthMethod'
    | 'essAuthMethod'
    | 'staffEnableMicrosoftLogin'
    | 'staffEnableGoogleLogin'
    | 'staffEnableEmailLogin'
    | 'essEnableMicrosoftLogin'
    | 'essEnableGoogleLogin'
    | 'essEnableEmailLogin'
  >,
  audience: PortalAudience,
  oauthConfigured?: { microsoft: boolean; google: boolean },
): PortalAuthMethod {
  const explicit =
    audience === 'staff' ? parsePortalAuthMethod(setup.staffAuthMethod) : parsePortalAuthMethod(setup.essAuthMethod);
  if (explicit) return explicit;

  const flags =
    audience === 'staff'
      ? {
          enableMicrosoft: setup.staffEnableMicrosoftLogin,
          enableGoogle: setup.staffEnableGoogleLogin,
          enableEmail: setup.staffEnableEmailLogin,
        }
      : {
          enableMicrosoft: setup.essEnableMicrosoftLogin,
          enableGoogle: setup.essEnableGoogleLogin,
          enableEmail: setup.essEnableEmailLogin,
        };

  return migrateLegacyAuthBooleans(flags, oauthConfigured);
}

export function applyAuthMethodToSetup(
  setup: CompanySetupSettings,
  audience: PortalAudience,
  method: PortalAuthMethod,
): CompanySetupSettings {
  const flags = authMethodToLegacyFlags(method);
  if (audience === 'staff') {
    return {
      ...setup,
      staffAuthMethod: method,
      staffEnableMicrosoftLogin: flags.enableMicrosoft,
      staffEnableGoogleLogin: flags.enableGoogle,
      staffEnableEmailLogin: flags.enableEmail,
    };
  }
  return {
    ...setup,
    essAuthMethod: method,
    essEnableMicrosoftLogin: flags.enableMicrosoft,
    essEnableGoogleLogin: flags.enableGoogle,
    essEnableEmailLogin: flags.enableEmail,
  };
}

/** Keep explicit auth method fields and legacy booleans in sync after load/save. */
export function syncAuthMethodFields(
  setup: CompanySetupSettings,
  oauthConfigured?: { microsoft: boolean; google: boolean },
): CompanySetupSettings {
  const staffMethod = getPortalAuthMethod(setup, 'staff', oauthConfigured);
  const essMethod = getPortalAuthMethod(setup, 'ess', oauthConfigured);
  return applyAuthMethodToSetup(applyAuthMethodToSetup(setup, 'staff', staffMethod), 'ess', essMethod);
}

export function isCredentialsLoginEnabled(
  setup: Pick<CompanySetupSettings, 'staffAuthMethod' | 'essAuthMethod' | 'staffEnableEmailLogin' | 'essEnableEmailLogin'>,
  audience: PortalAudience,
): boolean {
  return getPortalAuthMethod(setup, audience) === 'credentials';
}

export function isOAuthProviderActive(
  setup: CompanySetupSettings,
  audience: PortalAudience,
  provider: 'microsoft' | 'google',
): boolean {
  return getPortalAuthMethod(setup, audience) === provider;
}
