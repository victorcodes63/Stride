import {
  COMPANY_SETUP_SETTINGS_KEY,
  DEFAULT_COMPANY_SETUP,
  sanitizeCompanySetup,
  type CompanySetupSettings,
} from '../../src/lib/company-setup';
import { allModulesAdminEnabled } from '../../src/lib/modules';
import { DEFAULT_BRAND_LOGO_SRC } from '../../src/lib/brand-constants';
import type { DemoPack } from './types';

const DEFAULT_TAGLINE =
  'Human resources, payroll, recruitment, and workforce operations in one place.';

/** Build full company setup settings from a demo pack (stored in DB on seed). */
export function buildCompanySetupFromPack(pack: DemoPack): CompanySetupSettings {
  const cs = pack.companySetup;
  const orgName = cs.orgName ?? pack.workspace.name;

  return sanitizeCompanySetup({
    ...DEFAULT_COMPANY_SETUP,
    appName: cs.appName ?? 'Stride',
    orgName,
    tagline: cs.tagline ?? DEFAULT_TAGLINE,
    wordmark: cs.wordmark ?? orgName,
    logoSrc: DEFAULT_BRAND_LOGO_SRC,
    logoPngPath: DEFAULT_BRAND_LOGO_SRC,
    contactEmail: cs.contactEmail ?? pack.workspace.contactEmail,
    contactPhone: cs.contactPhone ?? pack.workspace.contactPhone,
    contactAddress: cs.contactAddress ?? pack.workspace.postalAddress,
    careersEmployerName: cs.careersEmployerName ?? pack.recruitmentEmployer,
    careersTagline: cs.careersTagline ?? cs.tagline ?? DEFAULT_TAGLINE,
    staffLoginWelcomeTitle: cs.staffLoginWelcomeTitle ?? `Welcome to ${orgName}`,
    staffLoginWelcomeSubtitle: cs.staffLoginWelcomeSubtitle ?? 'Sign in to manage your workforce',
    essLoginWelcomeTitle: cs.essLoginWelcomeTitle ?? 'Employee Self Service',
    essLoginWelcomeSubtitle: cs.essLoginWelcomeSubtitle ?? 'View payslips, leave, and personal details',
    payslipLegalName: cs.payslipLegalName ?? orgName,
    emailFromName: cs.emailFromName ?? `${orgName} HR`,
    publicFooterText:
      cs.publicFooterText ??
      `${orgName} — workforce operations across Kenya and Uganda.`,
    documentFooterText: cs.documentFooterText ?? '',
    moduleAdminFlags: allModulesAdminEnabled(),
  });
}

export { COMPANY_SETUP_SETTINGS_KEY };
