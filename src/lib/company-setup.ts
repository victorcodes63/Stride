import { prisma } from '@/lib/prisma';
import { withOrgContext } from '@/lib/org-context';
import { DEFAULT_ORGANIZATION_ID } from '@/lib/org-membership';
import {
  systemSettingCreate,
  systemSettingWhere,
} from '@/lib/system-setting-store';
import { DEFAULT_BRAND_LOGO_SRC, DEFAULT_LANDING_PATH } from '@/lib/brand-constants';
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  sanitizeHexColor,
} from '@/lib/brand-theme';
import {
  isGoogleOAuthConfigured,
  isMicrosoftOAuthConfigured,
  type OAuthProviderKey,
} from '@/lib/auth-providers';
import { isDemoMode, isPublicDemoMode } from '@/lib/deployment-config';
import { isCustomerProductionCell } from '@/lib/deployment-cell';
import { getPublicBrand } from '@/lib/brand';
import type { NextRequest } from 'next/server';
import { HRIS_ENTITY_COOKIE } from '@/lib/entity-constants';
import { companySetupKeyForContext, parseDemoEntitySlug } from '@/lib/demo-entity-slug';
import { isCustomLogo } from '@/lib/resolve-public-brand';
import { getOAuthStartPath, type OAuthAudience } from '@/lib/oauth-utils';
import {
  getPortalAuthMethod,
  parsePortalAuthMethod,
  syncAuthMethodFields,
  type PortalAuthMethod,
} from '@/lib/company-setup-auth';
import {
  allModulesAdminEnabled,
  defaultModuleAdminFlags,
  resolveEffectiveModules,
  sanitizeModuleAdminFlags,
  type ModuleKey,
} from '@/lib/modules';

export const COMPANY_SETUP_SETTINGS_KEY = 'admin.company.setup';

export type DashboardBannerTone = 'info' | 'warning' | 'success';

export type { PortalAuthMethod } from '@/lib/company-setup-auth';

export type CompanySetupSettings = {
  // Brand identity
  appName: string;
  orgName: string;
  tagline: string;
  wordmark: string;
  logoSrc: string;
  logoPngPath: string;
  faviconSrc: string;
  primaryColor: string;
  secondaryColor: string;
  // Login — one primary method per portal (legacy booleans kept in sync)
  staffAuthMethod: PortalAuthMethod;
  staffEnableMicrosoftLogin: boolean;
  staffEnableGoogleLogin: boolean;
  staffEnableEmailLogin: boolean;
  essAuthMethod: PortalAuthMethod;
  essEnableMicrosoftLogin: boolean;
  essEnableGoogleLogin: boolean;
  essEnableEmailLogin: boolean;
  staffLoginWelcomeTitle: string;
  staffLoginWelcomeSubtitle: string;
  essLoginWelcomeTitle: string;
  essLoginWelcomeSubtitle: string;
  // Contact & legal
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  supportUrl: string;
  emailFromName: string;
  // Portals & careers
  essPortalTitle: string;
  staffPortalTitle: string;
  careersEmployerName: string;
  careersTagline: string;
  careersHeroImageUrl: string;
  // Dashboard
  defaultLandingPath: string;
  dashboardBannerEnabled: boolean;
  dashboardBannerText: string;
  dashboardBannerTone: DashboardBannerTone;
  /** Alternating row backgrounds on dashboard data tables (uses brand primary/secondary tints). */
  dashboardTableZebraStriping: boolean;
  /** Admin toggles for licensed modules — hide nav/routes without redeploying. */
  moduleAdminFlags: Record<ModuleKey, boolean>;
  // Documents
  payslipLegalName: string;
  documentFooterText: string;
  /** Short about blurb on public site footer (careers, marketing pages). */
  publicFooterText: string;
  hidePoweredBy: boolean;
};

export const DEFAULT_COMPANY_SETUP: CompanySetupSettings = {
  appName: '',
  orgName: '',
  tagline: '',
  wordmark: '',
  logoSrc: '',
  logoPngPath: '',
  faviconSrc: '',
  primaryColor: DEFAULT_PRIMARY_COLOR,
  secondaryColor: DEFAULT_SECONDARY_COLOR,
  staffAuthMethod: 'credentials',
  staffEnableMicrosoftLogin: false,
  staffEnableGoogleLogin: false,
  staffEnableEmailLogin: true,
  essAuthMethod: 'credentials',
  essEnableMicrosoftLogin: false,
  essEnableGoogleLogin: false,
  essEnableEmailLogin: true,
  staffLoginWelcomeTitle: '',
  staffLoginWelcomeSubtitle: '',
  essLoginWelcomeTitle: '',
  essLoginWelcomeSubtitle: '',
  contactEmail: '',
  contactPhone: '',
  contactAddress: '',
  privacyPolicyUrl: '/privacy',
  termsUrl: '/terms',
  supportUrl: '',
  emailFromName: '',
  essPortalTitle: 'Employee Self Service',
  staffPortalTitle: '',
  careersEmployerName: '',
  careersTagline: '',
  careersHeroImageUrl: '',
  defaultLandingPath: DEFAULT_LANDING_PATH,
  dashboardBannerEnabled: false,
  dashboardBannerText: '',
  dashboardBannerTone: 'info',
  dashboardTableZebraStriping: true,
  moduleAdminFlags:
    isDemoMode() || isPublicDemoMode() ? allModulesAdminEnabled() : defaultModuleAdminFlags(),
  payslipLegalName: '',
  documentFooterText: '',
  publicFooterText: '',
  hidePoweredBy: false,
};

export type PublicCompanySetup = {
  staff: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    authMethod: PortalAuthMethod;
    microsoftLoginEnabled: boolean;
    googleLoginEnabled: boolean;
    emailLoginEnabled: boolean;
  };
  ess: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    portalTitle: string;
    authMethod: PortalAuthMethod;
    microsoftLoginEnabled: boolean;
    googleLoginEnabled: boolean;
    emailLoginEnabled: boolean;
  };
  legal: {
    privacyPolicyUrl: string;
    termsUrl: string;
    supportUrl: string;
  };
};

export type ProvisioningCheckItem = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  category: 'branding' | 'auth' | 'infra';
};

export type EffectiveOAuthProvider = {
  key: OAuthProviderKey;
  label: string;
  configured: boolean;
  enabled: boolean;
  startPath: string;
};

function str(raw: Record<string, unknown>, key: keyof CompanySetupSettings, fallback = ''): string {
  const v = raw[key as string];
  return typeof v === 'string' ? v.trim() : fallback;
}

function bool(raw: Record<string, unknown>, key: keyof CompanySetupSettings, fallback: boolean): boolean {
  const v = raw[key as string];
  return v === undefined ? fallback : Boolean(v);
}

export function sanitizeCompanySetup(value: unknown): CompanySetupSettings {
  const raw = (value ?? {}) as Record<string, unknown>;
  const d = DEFAULT_COMPANY_SETUP;
  const msOk = isMicrosoftOAuthConfigured();
  const googleOk = isGoogleOAuthConfigured();
  const oauthConfigured = { microsoft: msOk, google: googleOk };

  const partial: CompanySetupSettings = {
    appName: str(raw, 'appName'),
    orgName: str(raw, 'orgName'),
    tagline: str(raw, 'tagline'),
    wordmark: str(raw, 'wordmark'),
    logoSrc: str(raw, 'logoSrc'),
    logoPngPath: str(raw, 'logoPngPath'),
    faviconSrc: str(raw, 'faviconSrc'),
    primaryColor: sanitizeHexColor(raw.primaryColor, d.primaryColor),
    secondaryColor: sanitizeHexColor(raw.secondaryColor, d.secondaryColor),
    staffAuthMethod: parsePortalAuthMethod(raw.staffAuthMethod) ?? d.staffAuthMethod,
    staffEnableMicrosoftLogin: bool(raw, 'staffEnableMicrosoftLogin', d.staffEnableMicrosoftLogin),
    staffEnableGoogleLogin: bool(raw, 'staffEnableGoogleLogin', d.staffEnableGoogleLogin),
    staffEnableEmailLogin: bool(raw, 'staffEnableEmailLogin', d.staffEnableEmailLogin),
    essAuthMethod: parsePortalAuthMethod(raw.essAuthMethod) ?? d.essAuthMethod,
    essEnableMicrosoftLogin: bool(raw, 'essEnableMicrosoftLogin', d.essEnableMicrosoftLogin),
    essEnableGoogleLogin: bool(raw, 'essEnableGoogleLogin', d.essEnableGoogleLogin),
    essEnableEmailLogin: bool(raw, 'essEnableEmailLogin', d.essEnableEmailLogin),
    staffLoginWelcomeTitle: str(raw, 'staffLoginWelcomeTitle'),
    staffLoginWelcomeSubtitle: str(raw, 'staffLoginWelcomeSubtitle'),
    essLoginWelcomeTitle: str(raw, 'essLoginWelcomeTitle'),
    essLoginWelcomeSubtitle: str(raw, 'essLoginWelcomeSubtitle'),
    contactEmail: str(raw, 'contactEmail'),
    contactPhone: str(raw, 'contactPhone'),
    contactAddress: str(raw, 'contactAddress'),
    privacyPolicyUrl: str(raw, 'privacyPolicyUrl') || d.privacyPolicyUrl,
    termsUrl: str(raw, 'termsUrl') || d.termsUrl,
    supportUrl: str(raw, 'supportUrl'),
    emailFromName: str(raw, 'emailFromName'),
    essPortalTitle: str(raw, 'essPortalTitle') || d.essPortalTitle,
    staffPortalTitle: str(raw, 'staffPortalTitle'),
    careersEmployerName: str(raw, 'careersEmployerName'),
    careersTagline: str(raw, 'careersTagline'),
    careersHeroImageUrl: str(raw, 'careersHeroImageUrl'),
    defaultLandingPath: str(raw, 'defaultLandingPath') || d.defaultLandingPath,
    dashboardBannerEnabled: bool(raw, 'dashboardBannerEnabled', d.dashboardBannerEnabled),
    dashboardBannerText: str(raw, 'dashboardBannerText'),
    dashboardBannerTone:
      raw.dashboardBannerTone === 'warning' || raw.dashboardBannerTone === 'success'
        ? raw.dashboardBannerTone
        : 'info',
    dashboardTableZebraStriping: bool(raw, 'dashboardTableZebraStriping', d.dashboardTableZebraStriping),
    moduleAdminFlags:
      raw.moduleAdminFlags === undefined
        ? allModulesAdminEnabled()
        : sanitizeModuleAdminFlags(raw.moduleAdminFlags),
    payslipLegalName: str(raw, 'payslipLegalName'),
    documentFooterText: str(raw, 'documentFooterText'),
    publicFooterText: str(raw, 'publicFooterText'),
    hidePoweredBy: bool(raw, 'hidePoweredBy', d.hidePoweredBy),
  };

  return syncAuthMethodFields(partial, oauthConfigured);
}

export async function loadEffectiveModules(): Promise<Record<ModuleKey, boolean>> {
  const setup = await loadCompanySetupSettings();
  return resolveEffectiveModules(setup.moduleAdminFlags);
}

export async function loadCompanySetupSettings(contextId?: string | null): Promise<CompanySetupSettings> {
  if (!process.env.DATABASE_URL) return { ...DEFAULT_COMPANY_SETUP };
  const keys = contextId?.trim()
    ? [companySetupKeyForContext(contextId), COMPANY_SETUP_SETTINGS_KEY]
    : [COMPANY_SETUP_SETTINGS_KEY];
  try {
    for (const key of keys) {
      const row = await prisma.systemSetting.findUnique({
        where: systemSettingWhere(DEFAULT_ORGANIZATION_ID, key),
      });
      if (row) return sanitizeCompanySetup(row.value);
    }
    return { ...DEFAULT_COMPANY_SETUP };
  } catch {
    return { ...DEFAULT_COMPANY_SETUP };
  }
}

/** Tenant-scoped company setup — new orgs get blank defaults with their org name, not demo SwiftFreight. */
export async function loadCompanySetupSettingsForOrg(
  organizationId: string,
): Promise<CompanySetupSettings> {
  if (!process.env.DATABASE_URL) return { ...DEFAULT_COMPANY_SETUP };
  try {
    return await withOrgContext(organizationId, async (tx) => {
      const row = await tx.systemSetting.findUnique({
        where: systemSettingWhere(organizationId, COMPANY_SETUP_SETTINGS_KEY),
      });
      if (row) return sanitizeCompanySetup(row.value);
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });
      const orgName = org?.name?.trim();
      if (!orgName) return { ...DEFAULT_COMPANY_SETUP };
      return sanitizeCompanySetup({
        ...DEFAULT_COMPANY_SETUP,
        orgName,
        payslipLegalName: orgName,
        careersEmployerName: orgName,
      });
    });
  } catch {
    return { ...DEFAULT_COMPANY_SETUP };
  }
}

/** DB key used when admin saves — matches the active entity switcher context in multi-context demo. */
export function resolveCompanySetupStorageKey(entitySlug: string | null | undefined): string {
  if (entitySlug && entitySlug.includes('__')) {
    return companySetupKeyForContext(parseDemoEntitySlug(entitySlug).contextId);
  }
  return COMPANY_SETUP_SETTINGS_KEY;
}

export function companySetupStorageKeyFromRequest(request: Pick<NextRequest, 'cookies'>): string {
  return resolveCompanySetupStorageKey(request.cookies.get(HRIS_ENTITY_COOKIE)?.value ?? null);
}

export function companySetupContextLabel(entitySlug: string | null | undefined): string | null {
  if (!entitySlug?.includes('__')) return null;
  const { contextId } = parseDemoEntitySlug(entitySlug);
  const labels: Record<string, string> = {
    generic: 'Demo Corporation (generic)',
    'petroleum-retail': 'Northline Petroleum — fuel retail',
    'imara-sacco': 'Heritage Members SACCO',
    'cargo-logistics': 'SwiftFreight — cargo & logistics',
    'hospital-healthcare': 'Amani Medical Centre',
    'travel-agency': 'Horizon Travels',
  };
  return labels[contextId] ?? contextId;
}

export async function loadCompanySetupForStorageKey(
  key: string,
  organizationId: string = DEFAULT_ORGANIZATION_ID,
): Promise<CompanySetupSettings> {
  if (!process.env.DATABASE_URL) return { ...DEFAULT_COMPANY_SETUP };
  try {
    return await withOrgContext(organizationId, async (tx) => {
      const row = await tx.systemSetting.findUnique({
        where: systemSettingWhere(organizationId, key),
      });
      if (row) return sanitizeCompanySetup(row.value);
      if (key !== COMPANY_SETUP_SETTINGS_KEY) {
        const legacy = await tx.systemSetting.findUnique({
          where: systemSettingWhere(organizationId, COMPANY_SETUP_SETTINGS_KEY),
        });
        if (legacy) return sanitizeCompanySetup(legacy.value);
      }
      return { ...DEFAULT_COMPANY_SETUP };
    });
  } catch {
    return { ...DEFAULT_COMPANY_SETUP };
  }
}

export async function persistCompanySetupSettings(
  key: string,
  merged: CompanySetupSettings,
  updatedByUserId: string | null,
  organizationId: string,
): Promise<void> {
  await withOrgContext(organizationId, (tx) =>
    tx.systemSetting.upsert({
      where: systemSettingWhere(organizationId, key),
      update: { value: merged as unknown as import('@prisma/client').Prisma.InputJsonValue, updatedByUserId },
      create: systemSettingCreate(
        organizationId,
        key,
        merged as unknown as import('@prisma/client').Prisma.InputJsonValue,
        updatedByUserId,
      ),
    }),
  );
}

export function toPublicCompanySetup(setup: CompanySetupSettings): PublicCompanySetup {
  const staffMethod = getPortalAuthMethod(setup, 'staff');
  const essMethod = getPortalAuthMethod(setup, 'ess');
  return {
    staff: {
      welcomeTitle: setup.staffLoginWelcomeTitle,
      welcomeSubtitle: setup.staffLoginWelcomeSubtitle,
      authMethod: staffMethod,
      microsoftLoginEnabled: staffMethod === 'microsoft',
      googleLoginEnabled: staffMethod === 'google',
      emailLoginEnabled: staffMethod === 'credentials',
    },
    ess: {
      welcomeTitle: setup.essLoginWelcomeTitle,
      welcomeSubtitle: setup.essLoginWelcomeSubtitle,
      portalTitle: setup.essPortalTitle,
      authMethod: essMethod,
      microsoftLoginEnabled: essMethod === 'microsoft',
      googleLoginEnabled: essMethod === 'google',
      emailLoginEnabled: essMethod === 'credentials',
    },
    legal: {
      privacyPolicyUrl: setup.privacyPolicyUrl,
      termsUrl: setup.termsUrl,
      supportUrl: setup.supportUrl,
    },
  };
}

/** Merge empty org fields from the tenant Organization row (customer cells). */
export async function hydrateCompanySetupFromOrganization(
  setup: CompanySetupSettings,
  organizationId: string,
): Promise<CompanySetupSettings> {
  if (!process.env.DATABASE_URL || !organizationId.trim()) return setup;
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    const orgName = org?.name?.trim();
    if (!orgName) return setup;
    return sanitizeCompanySetup({
      ...setup,
      orgName: setup.orgName.trim() || orgName,
      payslipLegalName: setup.payslipLegalName.trim() || orgName,
      careersEmployerName: setup.careersEmployerName.trim() || orgName,
    });
  } catch {
    return setup;
  }
}

/** Customer-facing checklist — no deployment infra or env-var jargon. */
export function buildWorkspaceSetupChecklist(setup: CompanySetupSettings): ProvisioningCheckItem[] {
  const logo = setup.logoSrc.trim() || setup.logoPngPath.trim();
  const msOk = isMicrosoftOAuthConfigured();
  const googleOk = isGoogleOAuthConfigured();
  const staffAuthMethod = getPortalAuthMethod(setup, 'staff', { microsoft: msOk, google: googleOk });
  const essAuthMethod = getPortalAuthMethod(setup, 'ess', { microsoft: msOk, google: googleOk });

  const authDetail = (
    method: ReturnType<typeof getPortalAuthMethod>,
    configured: boolean,
  ): { ok: boolean; detail: string } => {
    if (method === 'credentials') {
      return { ok: true, detail: 'Email and password' };
    }
    if (configured) {
      return {
        ok: true,
        detail: method === 'microsoft' ? 'Microsoft work or school accounts' : 'Google Workspace accounts',
      };
    }
    return {
      ok: false,
      detail:
        method === 'microsoft'
          ? 'Microsoft sign-in selected — contact Raven Tech Group to complete setup'
          : 'Google sign-in selected — contact Raven Tech Group to complete setup',
    };
  };

  const staffAuth = authDetail(staffAuthMethod, staffAuthMethod === 'microsoft' ? msOk : googleOk);
  const essAuth = authDetail(essAuthMethod, essAuthMethod === 'microsoft' ? msOk : googleOk);

  return [
    {
      id: 'logo',
      label: 'Company logo',
      ok: isCustomLogo(logo),
      detail: isCustomLogo(logo) ? 'Custom logo configured' : 'Upload your logo below',
      category: 'branding',
    },
    {
      id: 'org-name',
      label: 'Organisation name',
      ok: Boolean(setup.orgName.trim()),
      detail: setup.orgName.trim() || 'Set your company name',
      category: 'branding',
    },
    {
      id: 'address',
      label: 'Contact address',
      ok: Boolean(setup.contactAddress.trim()),
      detail: setup.contactAddress.trim() || 'Used on payslips, invoices, and letters',
      category: 'branding',
    },
    {
      id: 'contact-email',
      label: 'Support email',
      ok: Boolean(setup.contactEmail.trim()),
      detail: setup.contactEmail.trim() || 'Shown on careers and contact blocks',
      category: 'branding',
    },
    {
      id: 'document-footer',
      label: 'Document footer',
      ok: Boolean(setup.documentFooterText.trim()),
      detail: setup.documentFooterText.trim() || 'Optional — registered office, company reg. no.',
      category: 'branding',
    },
    {
      id: 'staff-auth',
      label: 'Staff sign-in',
      ok: staffAuth.ok,
      detail: staffAuth.detail,
      category: 'auth',
    },
    {
      id: 'ess-auth',
      label: 'Employee portal sign-in',
      ok: essAuth.ok,
      detail: essAuth.detail,
      category: 'auth',
    },
  ];
}

export function buildCompanySetupChecklist(setup: CompanySetupSettings): ProvisioningCheckItem[] {
  if (isCustomerProductionCell()) {
    return buildWorkspaceSetupChecklist(setup);
  }
  return buildProvisioningChecklist(setup);
}

export function buildProvisioningChecklist(setup: CompanySetupSettings): ProvisioningCheckItem[] {
  const envBrand = getPublicBrand();
  const logo = setup.logoSrc.trim() || envBrand.logoSrc;
  const smtpOk = Boolean(process.env.SMTP_HOST?.trim());
  const siteUrlOk = Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim());
  const blobOk = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  const msOk = isMicrosoftOAuthConfigured();
  const googleOk = isGoogleOAuthConfigured();
  const staffAuthMethod = getPortalAuthMethod(setup, 'staff', { microsoft: msOk, google: googleOk });
  const essAuthMethod = getPortalAuthMethod(setup, 'ess', { microsoft: msOk, google: googleOk });
  const staffAuthOk =
    staffAuthMethod === 'credentials' ||
    (staffAuthMethod === 'microsoft' && msOk) ||
    (staffAuthMethod === 'google' && googleOk);
  const essAuthOk =
    essAuthMethod === 'credentials' ||
    (essAuthMethod === 'microsoft' && msOk) ||
    (essAuthMethod === 'google' && googleOk);

  return [
    {
      id: 'logo',
      label: 'Company logo',
      ok: isCustomLogo(logo),
      detail: isCustomLogo(logo) ? 'Custom logo configured' : 'Using default logo — upload yours in Brand identity',
      category: 'branding',
    },
    {
      id: 'org-name',
      label: 'Organisation name',
      ok: Boolean(setup.orgName.trim() || envBrand.orgName),
      detail: setup.orgName.trim() || envBrand.orgName || 'Set app or org name',
      category: 'branding',
    },
    {
      id: 'site-url',
      label: 'Production site URL',
      ok: siteUrlOk,
      detail: siteUrlOk ? process.env.NEXT_PUBLIC_SITE_URL!.trim() : 'Set NEXT_PUBLIC_SITE_URL in deployment env',
      category: 'infra',
    },
    {
      id: 'smtp',
      label: 'Email (SMTP)',
      ok: smtpOk,
      detail: smtpOk ? 'SMTP configured' : 'Configure SMTP_* for transactional email',
      category: 'infra',
    },
    {
      id: 'blob',
      label: 'File uploads (Blob)',
      ok: blobOk,
      detail: blobOk ? 'Vercel Blob token set' : 'Optional locally; set BLOB_READ_WRITE_TOKEN in production',
      category: 'infra',
    },
    {
      id: 'staff-auth',
      label: 'Staff sign-in method',
      ok: staffAuthOk,
      detail: staffAuthOk
        ? staffAuthMethod === 'credentials'
          ? 'Email and password enabled'
          : staffAuthMethod === 'microsoft'
            ? 'Microsoft SSO configured'
            : 'Google SSO configured'
        : staffAuthMethod === 'microsoft'
          ? 'Microsoft selected but MS_* env vars missing'
          : staffAuthMethod === 'google'
            ? 'Google selected but GOOGLE_* env vars missing'
            : 'Configure a sign-in method in Staff sign-in',
      category: 'auth',
    },
    {
      id: 'ess-auth',
      label: 'ESS sign-in method',
      ok: essAuthOk,
      detail: essAuthOk
        ? essAuthMethod === 'credentials'
          ? 'Email and password enabled'
          : essAuthMethod === 'microsoft'
            ? 'Microsoft SSO configured'
            : 'Google SSO configured'
        : essAuthMethod === 'microsoft'
          ? 'Microsoft selected but MS_* env vars missing'
          : essAuthMethod === 'google'
            ? 'Google selected but GOOGLE_* env vars missing'
            : 'Configure a sign-in method in Employee portal',
      category: 'auth',
    },
    {
      id: 'demo-off',
      label: 'Demo mode disabled',
      ok: !isDemoMode() && !isPublicDemoMode(),
      detail: !isDemoMode() && !isPublicDemoMode() ? 'Production mode' : 'DEMO_MODE is on — turn off for paying clients',
      category: 'infra',
    },
  ];
}

export function getEffectiveOAuthProviders(
  audience: OAuthAudience,
  setup: CompanySetupSettings,
): EffectiveOAuthProvider[] {
  const method = getPortalAuthMethod(setup, audience);

  return (['microsoft', 'google'] as const)
    .filter((key) => method === key)
    .map((key) => ({
      key,
      label: key === 'microsoft' ? 'Microsoft' : 'Google',
      configured: key === 'microsoft' ? isMicrosoftOAuthConfigured() : isGoogleOAuthConfigured(),
      enabled: true,
      startPath: getOAuthStartPath(audience, key),
    }));
}

export async function getPublicOAuthProviders(audience: OAuthAudience) {
  const setup = await loadCompanySetupSettings();
  return getEffectiveOAuthProviders(audience, setup).filter((p) => p.enabled);
}

