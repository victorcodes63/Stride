import type { DeploymentTier } from '@/lib/deployment-tier';
import type { CompanySetupSettings } from '@/lib/company-setup';
import {
  applyAuthMethodToSetup,
  getPortalAuthMethod,
  syncAuthMethodFields,
  type PortalAuthMethod,
} from '@/lib/company-setup-auth';

export type CompanySetupCapabilities = {
  tier: DeploymentTier;
  /** Growth+ — choose Microsoft, Google, or email/password per portal. */
  canConfigureAuthPolicy: boolean;
  allowedAuthMethods: PortalAuthMethod[];
  /** Enterprise — hide “Powered by Stride” on applicable surfaces. */
  canConfigureWhiteLabel: boolean;
  /** Growth+ — operating regions / entity switcher. */
  canConfigureMultiEntity: boolean;
  /** Growth+ — careers portal branding and hero. */
  canConfigureCareersPortal: boolean;
  /** Enterprise — HR announcement banner on dashboard home. */
  canConfigureDashboardBanner: boolean;
  /** Enterprise — disable password login when SSO is configured. */
  canEnforceSso: boolean;
  /** Growth+ — toggle licensed modules in navigation. */
  canConfigureModuleNav: boolean;
};

export function getCompanySetupCapabilities(tier: DeploymentTier): CompanySetupCapabilities {
  switch (tier) {
    case 'starter':
      return {
        tier,
        canConfigureAuthPolicy: false,
        allowedAuthMethods: ['credentials'],
        canConfigureWhiteLabel: false,
        canConfigureMultiEntity: false,
        canConfigureCareersPortal: false,
        canConfigureDashboardBanner: false,
        canConfigureModuleNav: false,
        canEnforceSso: false,
      };
    case 'growth':
      return {
        tier,
        canConfigureAuthPolicy: true,
        allowedAuthMethods: ['microsoft', 'google', 'credentials'],
        canConfigureWhiteLabel: false,
        canConfigureMultiEntity: true,
        canConfigureCareersPortal: true,
        canConfigureDashboardBanner: false,
        canConfigureModuleNav: true,
        canEnforceSso: false,
      };
    case 'enterprise':
      return {
        tier,
        canConfigureAuthPolicy: true,
        allowedAuthMethods: ['microsoft', 'google', 'credentials'],
        canConfigureWhiteLabel: true,
        canConfigureMultiEntity: true,
        canConfigureCareersPortal: true,
        canConfigureDashboardBanner: true,
        canConfigureModuleNav: true,
        canEnforceSso: true,
      };
  }
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

/** Strip or reset fields the deployment tier is not entitled to configure. */
export function enforceCompanySetupTier(
  setup: CompanySetupSettings,
  caps: CompanySetupCapabilities,
  oauthConfigured?: { microsoft: boolean; google: boolean },
): CompanySetupSettings {
  let next = { ...setup };

  if (!caps.canConfigureWhiteLabel) {
    next.hidePoweredBy = false;
  }

  if (!caps.canConfigureDashboardBanner) {
    next.dashboardBannerEnabled = false;
    next.dashboardBannerText = '';
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

export function companySetupFeatureLabel(feature: keyof Omit<CompanySetupCapabilities, 'tier' | 'allowedAuthMethods'>): string {
  switch (feature) {
    case 'canConfigureAuthPolicy':
      return 'Sign-in method configuration';
    case 'canConfigureWhiteLabel':
      return 'White-label branding';
    case 'canConfigureMultiEntity':
      return 'Multi-entity / operating regions';
    case 'canConfigureCareersPortal':
      return 'Careers portal customization';
    case 'canConfigureDashboardBanner':
      return 'Dashboard announcement banner';
    case 'canConfigureModuleNav':
      return 'Module navigation toggles';
    default:
      return 'This feature';
  }
}

export function companySetupUpgradeHint(tier: DeploymentTier, feature: keyof Omit<CompanySetupCapabilities, 'tier' | 'allowedAuthMethods'>): string {
  const label = companySetupFeatureLabel(feature);
  if (tier === 'growth' && feature === 'canConfigureWhiteLabel') {
    return `${label} is available on Enterprise. Contact Raven Tech Group to upgrade.`;
  }
  if (tier === 'growth' && feature === 'canConfigureDashboardBanner') {
    return `${label} is available on Enterprise. Contact Raven Tech Group to upgrade.`;
  }
  return `${label} is not included on your plan. Contact Raven Tech Group to upgrade.`;
}
