import type { DeploymentTier } from '@/lib/deployment-tier';
import type { CompanySetupSettings } from '@/lib/company-setup';
import { DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR } from '@/lib/brand-theme';
import {
  applyAuthMethodToSetup,
  getPortalAuthMethod,
  syncAuthMethodFields,
  type PortalAuthMethod,
} from '@/lib/company-setup-auth';

/** Per-customer feature overrides from the control plane (`whitelabel`, `custom_domain`, ...). */
export type CompanySetupFeatureOverrides = Record<string, boolean | number | null>;

export type CompanySetupCapabilities = {
  tier: DeploymentTier;
  /** Growth+ — choose Microsoft, Google, or email/password per portal. */
  canConfigureAuthPolicy: boolean;
  allowedAuthMethods: PortalAuthMethod[];
  /** Growth+ (or white-label add-on) — custom primary/secondary colour scheme. */
  canConfigureColorScheme: boolean;
  /** Enterprise (or white-label add-on) — app identity + hide “Powered by Stride”. */
  canConfigureWhiteLabel: boolean;
  /** Enterprise (or custom-domain add-on) — vanity domain request for the workspace. */
  canConfigureCustomDomain: boolean;
  /** Growth+ (or multi-entity add-on) — operating regions / entity switcher. */
  canConfigureMultiEntity: boolean;
  /** Growth+ — careers portal branding and hero. */
  canConfigureCareersPortal: boolean;
  /** Enterprise (or white-label add-on) — HR announcement banner on dashboard home. */
  canConfigureDashboardBanner: boolean;
  /** Enterprise — disable password login when SSO is configured. */
  canEnforceSso: boolean;
  /** Enterprise — SAML IdP metadata (AUTH-09 stub; Raven activates). */
  canConfigureSaml: boolean;
  /** Growth+ — toggle licensed modules in navigation. */
  canConfigureModuleNav: boolean;
  /**
   * Capabilities unlocked by a per-customer add-on (control-plane feature toggle) rather than the
   * base plan tier. Used by the UI to badge them as "Add-on" instead of "Included".
   */
  addOns: CompanySetupCapabilityFeature[];
};

/** Capability flags that map to a user-facing feature (excludes metadata + auth-method list). */
export type CompanySetupCapabilityFeature = keyof Omit<
  CompanySetupCapabilities,
  'tier' | 'allowedAuthMethods' | 'addOns'
>;

export type CompanySetupCapabilityInput =
  | DeploymentTier
  | { tier?: DeploymentTier; features?: CompanySetupFeatureOverrides | null };

function normalizeInput(input: CompanySetupCapabilityInput): {
  tier: DeploymentTier;
  features: CompanySetupFeatureOverrides;
} {
  if (typeof input === 'string') return { tier: input, features: {} };
  return { tier: input.tier ?? 'enterprise', features: input.features ?? {} };
}

function featureOn(features: CompanySetupFeatureOverrides, key: string): boolean {
  const value = features[key];
  return value === true || (typeof value === 'number' && value > 0);
}

/**
 * Resolve which company-setup / branding controls a tenant may configure.
 *
 * The control plane owns the authoritative envelope: the plan `tier` sets the baseline, and
 * per-customer feature toggles (`whitelabel`, `custom_domain`, `multi_entity`) can unlock
 * capabilities beyond that baseline as add-ons for specific clients. The tenant never decides
 * what is unlocked — only how it is configured within the envelope. Demo cells resolve to
 * enterprise → full capabilities.
 */
export function getCompanySetupCapabilities(
  input: CompanySetupCapabilityInput = 'enterprise',
): CompanySetupCapabilities {
  const { tier, features } = normalizeInput(input);
  const growth = tier === 'growth' || tier === 'enterprise';
  const enterprise = tier === 'enterprise';

  const whitelabelAddOn = featureOn(features, 'whitelabel');
  const customDomainAddOn = featureOn(features, 'custom_domain');
  const multiEntityAddOn = featureOn(features, 'multi_entity');

  // Tier baseline (what the plan includes without any add-on).
  const baseline = {
    canConfigureColorScheme: growth,
    canConfigureWhiteLabel: enterprise,
    canConfigureCustomDomain: enterprise,
    canConfigureMultiEntity: growth,
    canConfigureDashboardBanner: enterprise,
  };

  // Effective capabilities (baseline OR add-on grant).
  const effective = {
    canConfigureColorScheme: baseline.canConfigureColorScheme || whitelabelAddOn,
    canConfigureWhiteLabel: baseline.canConfigureWhiteLabel || whitelabelAddOn,
    canConfigureCustomDomain: baseline.canConfigureCustomDomain || customDomainAddOn,
    canConfigureMultiEntity: baseline.canConfigureMultiEntity || multiEntityAddOn,
    canConfigureDashboardBanner: baseline.canConfigureDashboardBanner || whitelabelAddOn,
  };

  const addOns = (Object.keys(effective) as (keyof typeof effective)[]).filter(
    (key) => effective[key] && !baseline[key],
  );

  return {
    tier,
    canConfigureAuthPolicy: growth,
    allowedAuthMethods: growth ? ['microsoft', 'google', 'credentials'] : ['credentials'],
    canConfigureColorScheme: effective.canConfigureColorScheme,
    canConfigureWhiteLabel: effective.canConfigureWhiteLabel,
    canConfigureCustomDomain: effective.canConfigureCustomDomain,
    canConfigureMultiEntity: effective.canConfigureMultiEntity,
    canConfigureCareersPortal: growth,
    canConfigureDashboardBanner: effective.canConfigureDashboardBanner,
    canConfigureModuleNav: growth,
    canEnforceSso: enterprise,
    canConfigureSaml: enterprise,
    addOns,
  };
}

/** True when a capability is unlocked via a per-customer add-on rather than the base plan tier. */
export function isCompanySetupAddOn(
  caps: CompanySetupCapabilities,
  feature: CompanySetupCapabilityFeature,
): boolean {
  return caps.addOns.includes(feature);
}

function clampAuthMethod(
  setup: CompanySetupSettings,
  audience: 'staff' | 'ess',
  allowed: PortalAuthMethod[],
): CompanySetupSettings {
  const current = getPortalAuthMethod(setup, audience);
  if (allowed.includes(current)) return setup;
  return applyAuthMethodToSetup(setup, audience, allowed[0] ?? 'credentials');
}

/** Strip or reset fields the deployment envelope (tier + add-ons) is not entitled to configure. */
export function enforceCompanySetupTier(
  setup: CompanySetupSettings,
  caps: CompanySetupCapabilities,
  oauthConfigured?: { microsoft: boolean; google: boolean },
): CompanySetupSettings {
  let next = { ...setup };

  if (!caps.canConfigureColorScheme) {
    next.primaryColor = DEFAULT_PRIMARY_COLOR;
    next.secondaryColor = DEFAULT_SECONDARY_COLOR;
  }

  if (!caps.canConfigureWhiteLabel) {
    next.hidePoweredBy = false;
    // Product identity stays Stride below enterprise — clear any custom app name / wordmark.
    next.appName = '';
    next.wordmark = '';
  }

  if (!caps.canConfigureCustomDomain) {
    next.customDomain = '';
  }

  if (!caps.canConfigureDashboardBanner) {
    next.dashboardBannerEnabled = false;
    next.dashboardBannerText = '';
  }

  if (!caps.canConfigureSaml) {
    next.samlIdpMetadataUrl = '';
    next.samlEnabledStaff = false;
    next.samlEnabledEss = false;
  }

  if (!caps.canConfigureCareersPortal) {
    next.careersHeroImageUrl = '';
    next.careersTagline = '';
  }

  if (!caps.canConfigureAuthPolicy) {
    next = applyAuthMethodToSetup(next, 'staff', 'credentials');
    next = applyAuthMethodToSetup(next, 'ess', 'credentials');
  } else {
    next = clampAuthMethod(next, 'staff', caps.allowedAuthMethods);
    next = clampAuthMethod(next, 'ess', caps.allowedAuthMethods);
  }

  return syncAuthMethodFields(next, oauthConfigured);
}

export function companySetupFeatureLabel(feature: CompanySetupCapabilityFeature): string {
  switch (feature) {
    case 'canConfigureAuthPolicy':
      return 'Sign-in method configuration';
    case 'canConfigureColorScheme':
      return 'Custom colour scheme';
    case 'canConfigureWhiteLabel':
      return 'White-label branding';
    case 'canConfigureCustomDomain':
      return 'Custom domain';
    case 'canConfigureMultiEntity':
      return 'Multi-entity / operating regions';
    case 'canConfigureCareersPortal':
      return 'Careers portal customization';
    case 'canConfigureDashboardBanner':
      return 'Dashboard announcement banner';
    case 'canConfigureModuleNav':
      return 'Module navigation toggles';
    case 'canEnforceSso':
      return 'SSO enforcement';
    case 'canConfigureSaml':
      return 'Enterprise SAML';
    default:
      return 'This feature';
  }
}

/** Features that Raven can grant on lower tiers as a per-customer add-on. */
const ADD_ON_ELIGIBLE: ReadonlySet<CompanySetupCapabilityFeature> = new Set([
  'canConfigureWhiteLabel',
  'canConfigureCustomDomain',
  'canConfigureMultiEntity',
  'canConfigureColorScheme',
  'canConfigureDashboardBanner',
]);

export function companySetupUpgradeHint(
  tier: DeploymentTier,
  feature: CompanySetupCapabilityFeature,
): string {
  const label = companySetupFeatureLabel(feature);
  if (ADD_ON_ELIGIBLE.has(feature)) {
    return `${label} is available on Enterprise, or as an add-on on your plan. Contact Raven Tech Group to enable it.`;
  }
  return `${label} is not included on your plan. Contact Raven Tech Group to upgrade.`;
}
