import { brand, getPublicBrand, type PublicBrand } from '@/lib/brand';
import { brandConfig } from '@/lib/brand.config';
import { DEFAULT_BRAND_LOGO_SRC, isLegacyPlatformLogo, normalizeLogoSrc } from '@/lib/brand-constants';
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  sanitizeHexColor,
} from '@/lib/brand-theme';
import type { CompanySetupSettings } from '@/lib/company-setup';

function pickString(dbValue: string | undefined, envValue: string): string {
  return dbValue?.trim() ? dbValue.trim() : envValue;
}

const STRIDE_LOGO = normalizeLogoSrc(DEFAULT_BRAND_LOGO_SRC);

function resolveTenantLogo(setup: CompanySetupSettings, env: PublicBrand): string {
  const candidate = normalizeLogoSrc(
    pickString(setup.logoPngPath || setup.logoSrc, env.tenantLogoSrc || env.logoSrc),
  );
  if (
    candidate &&
    candidate !== STRIDE_LOGO &&
    !isLegacyPlatformLogo(candidate) &&
    !candidate.endsWith('platform-logo.png')
  ) {
    return candidate;
  }
  return STRIDE_LOGO;
}

/**
 * Merge tenant company setup with platform defaults.
 * Product identity (app name, public logo, wordmark) is always Stride — never tenant-overridable.
 * Org name, tenant logo, payslip legal name, and careers copy come from company setup (dashboard).
 */
export function resolvePublicBrand(setup: CompanySetupSettings): PublicBrand {
  const env = getPublicBrand();
  const orgName = pickString(setup.orgName, env.orgName);
  const tenantLogoSrc = resolveTenantLogo(setup, env);
  const productTagline = brandConfig.tagline;

  return {
    orgName,
    appName: brandConfig.productName,
    wordmark: brandConfig.productName,
    tagline: productTagline,
    contactEmail: pickString(setup.contactEmail, env.contactEmail),
    contactPhone: pickString(setup.contactPhone, env.contactPhone),
    contactAddress: pickString(setup.contactAddress, env.contactAddress),
    logoSrc: STRIDE_LOGO,
    logoPngPath: STRIDE_LOGO,
    tenantLogoSrc,
    faviconSrc: STRIDE_LOGO,
    primaryColor: sanitizeHexColor(setup.primaryColor, DEFAULT_PRIMARY_COLOR),
    secondaryColor: sanitizeHexColor(setup.secondaryColor, DEFAULT_SECONDARY_COLOR),
    privacyPolicyUrl: setup.privacyPolicyUrl?.trim() || '/privacy',
    termsUrl: setup.termsUrl?.trim() || '/terms',
    supportUrl: setup.supportUrl?.trim() || '',
    emailFromName: pickString(setup.emailFromName, `${brandConfig.productName} HR`),
    careersEmployerName: pickString(setup.careersEmployerName, orgName),
    careersTagline: pickString(setup.careersTagline, pickString(setup.tagline, productTagline)),
    careersHeroImageUrl: pickString(setup.careersHeroImageUrl, ''),
    essPortalTitle: pickString(setup.essPortalTitle, 'Employee Self Service'),
    staffPortalTitle: pickString(setup.staffPortalTitle, ''),
    payslipLegalName: pickString(setup.payslipLegalName, orgName),
    documentFooterText: setup.documentFooterText?.trim() || '',
    publicFooterText: pickString(setup.publicFooterText, env.publicFooterText),
    defaultLandingPath: setup.defaultLandingPath?.trim() || '/dashboard',
    dashboardBannerEnabled: Boolean(setup.dashboardBannerEnabled),
    dashboardBannerText: setup.dashboardBannerText?.trim() || '',
    dashboardBannerTone:
      setup.dashboardBannerTone === 'warning' || setup.dashboardBannerTone === 'success'
        ? setup.dashboardBannerTone
        : 'info',
    dashboardTableZebraStriping: Boolean(setup.dashboardTableZebraStriping),
    hidePoweredBy: Boolean(setup.hidePoweredBy),
  };
}

export function isCustomLogo(logoSrc: string): boolean {
  const t = logoSrc.trim();
  return Boolean(
    t &&
      t !== DEFAULT_BRAND_LOGO_SRC &&
      !isLegacyPlatformLogo(t) &&
      !t.endsWith('platform-logo.png'),
  );
}
