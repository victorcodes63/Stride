/**
 * Central branding for Stride deployments.
 * Product name is always Stride on public surfaces; tenant org names apply inside the dashboard.
 */

import { resolve } from 'path';
import { brandConfig } from '@/lib/brand.config';
import { DEFAULT_BRAND_LOGO_SRC, normalizeLogoSrc } from '@/lib/brand-constants';
export { DEFAULT_BRAND_LOGO_SRC } from '@/lib/brand-constants';
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
} from '@/lib/brand-theme';

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

const STRIDE_LOGO = normalizeLogoSrc(DEFAULT_BRAND_LOGO_SRC);

/** Env-level defaults — org/contact only; product identity is fixed in brandConfig. */
export const brand = {
  appName: brandConfig.productName,
  orgName: trimEnv('NEXT_PUBLIC_ORG_NAME') ?? 'Your Organisation',
  tagline: brandConfig.tagline,
  contactEmail: trimEnv('NEXT_PUBLIC_CONTACT_EMAIL') ?? brandConfig.supportEmail,
  contactPhone: trimEnv('NEXT_PUBLIC_CONTACT_PHONE') ?? '',
  contactAddress: trimEnv('NEXT_PUBLIC_CONTACT_ADDRESS') ?? '',
  logoSrc: STRIDE_LOGO,
  logoPngPath: STRIDE_LOGO,
  wordmark: brandConfig.productName,
} as const;

export const mailFromName = trimEnv('SMTP_FROM_NAME') ?? `${brandConfig.productName} HR`;

export const accountsMailFromName =
  trimEnv('ACCOUNTS_SMTP_FROM_NAME') ?? `${brandConfig.productName} HR (Accounts)`;

export function getSiteUrl(): string {
  return (
    trimEnv('NEXT_PUBLIC_SITE_URL')?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}`.replace(/\/$/, '') : '') ||
    'http://localhost:3000'
  );
}

export function getPublicLogoUrl(): string {
  return `${getSiteUrl()}${brand.logoSrc.startsWith('/') ? brand.logoSrc : `/${brand.logoSrc}`}`;
}

export function getLogoFileAbsolutePath(logoPath: string = brand.logoPngPath): string {
  const rel = logoPath.replace(/^\//, '');
  return resolve(process.cwd(), 'public', rel);
}

export function getMetadataTitle(suffix?: string): string {
  if (suffix) return `${suffix} | ${brandConfig.productName}`;
  return brandConfig.productName;
}

export const emailSubjectTag = `[${brandConfig.productName}]`;

/** Serializable brand snapshot for client components (root BrandProvider). */
export type PublicBrand = {
  orgName: string;
  /** Always Stride — platform product name, not tenant-configurable. */
  appName: string;
  tagline: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  /** Stride mark — used on all public / auth surfaces. */
  logoSrc: string;
  logoPngPath: string;
  /** Tenant logo from company setup — dashboard sidebar, payslips, letters. */
  tenantLogoSrc: string;
  wordmark: string;
  faviconSrc: string;
  primaryColor: string;
  secondaryColor: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  supportUrl: string;
  emailFromName: string;
  careersEmployerName: string;
  careersTagline: string;
  careersHeroImageUrl: string;
  essPortalTitle: string;
  staffPortalTitle: string;
  payslipLegalName: string;
  documentFooterText: string;
  publicFooterText: string;
  defaultLandingPath: string;
  dashboardBannerEnabled: boolean;
  dashboardBannerText: string;
  dashboardBannerTone: 'info' | 'warning' | 'success';
  dashboardTableZebraStriping: boolean;
  hidePoweredBy: boolean;
};

export function getPublicBrand(): PublicBrand {
  return {
    orgName: brand.orgName,
    appName: brandConfig.productName,
    tagline: brand.tagline,
    contactEmail: brand.contactEmail,
    contactPhone: brand.contactPhone,
    contactAddress: brand.contactAddress,
    logoSrc: brand.logoSrc,
    logoPngPath: brand.logoPngPath,
    tenantLogoSrc: brand.logoSrc,
    wordmark: brandConfig.productName,
    faviconSrc: brand.logoSrc,
    primaryColor: DEFAULT_PRIMARY_COLOR,
    secondaryColor: DEFAULT_SECONDARY_COLOR,
    privacyPolicyUrl: '/privacy',
    termsUrl: '/terms',
    supportUrl: '',
    emailFromName: mailFromName,
    careersEmployerName: brand.orgName,
    careersTagline: brand.tagline,
    careersHeroImageUrl: '',
    essPortalTitle: 'Employee Self Service',
    staffPortalTitle: '',
    payslipLegalName: brand.orgName,
    documentFooterText: '',
    publicFooterText: '',
    defaultLandingPath: '/dashboard',
    dashboardBannerEnabled: false,
    dashboardBannerText: '',
    dashboardBannerTone: 'info',
    dashboardTableZebraStriping: true,
    hidePoweredBy: false,
  };
}

/** Plain-text style footer for HTML emails (address optional). */
export function getEmailFooterPlain(): string {
  const bits: string[] = [mailFromName];
  if (brand.contactAddress) bits.push(brand.contactAddress);
  if (brand.contactPhone) bits.push(brand.contactPhone);
  bits.push(brand.contactEmail);
  return bits.join(' · ');
}
