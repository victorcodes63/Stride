import type { Prisma } from '@prisma/client';
import { withOrgContext } from '@/lib/org-context';
import { loadCompanySetupSettingsForOrg } from '@/lib/company-setup';
import { resolvePublicBrand, isCustomLogo } from '@/lib/resolve-public-brand';
import {
  systemSettingCreate,
  systemSettingWhere,
} from '@/lib/system-setting-store';
import { DEFAULT_PRIMARY_COLOR, isValidHexColor, sanitizeHexColor } from '@/lib/brand-theme';
import { ensureDefaultPaymentAccounts } from '@/lib/payment-accounts';

export const INVOICE_SETUP_SETTINGS_KEY = 'accounts.invoice.setup';

export type InvoiceLetterheadMode = 'preprinted' | 'embedded_logo';

export type InvoiceSetupSettings = {
  letterheadMode: InvoiceLetterheadMode;
  vatPin: string;
  invoiceLegalName: string;
  logoSrc: string;
  contactAddress: string;
  contactEmail: string;
  contactPhone: string;
  documentFooterText: string;
  primaryColor: string;
  /** Optional full-width header band behind logo (empty = white). */
  headerBackgroundColor: string;
  /** Table header, invoice-to box, and payment-details panel (empty = light grey default). */
  panelBackgroundColor: string;
};

export const DEFAULT_INVOICE_SETUP: InvoiceSetupSettings = {
  letterheadMode: 'preprinted',
  vatPin: '',
  invoiceLegalName: '',
  logoSrc: '',
  contactAddress: '',
  contactEmail: '',
  contactPhone: '',
  documentFooterText: '',
  primaryColor: '',
  headerBackgroundColor: '',
  panelBackgroundColor: '',
};

export type InvoicePdfBranding = {
  legalName: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl: string;
  hasCustomLogo: boolean;
  documentFooter: string;
  primaryColor: string;
  headerBackgroundColor: string;
  panelBackgroundColor: string;
  vatPin: string;
  letterheadMode: InvoiceLetterheadMode;
};

export type InvoiceSetupCheckItem = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  anchor?: string;
  href?: string;
};

export type InvoiceSetupSnapshot = {
  settings: InvoiceSetupSettings;
  /** Effective values used on invoice PDFs (includes legacy fallbacks until saved). */
  resolved: InvoiceSetupSettings;
  branding: InvoicePdfBranding;
  checklist: InvoiceSetupCheckItem[];
  paymentAccountCount: number;
};

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Persist only explicitly valid hex; empty string = inherit from company setup on PDFs. */
export function sanitizeInvoicePrimaryColor(value: unknown): string {
  if (typeof value !== 'string') return '';
  const t = value.trim();
  if (!t) return '';
  const withHash = t.startsWith('#') ? t : `#${t}`;
  return isValidHexColor(withHash) ? withHash.toUpperCase() : '';
}

export function resolveInvoicePrimaryColor(stored: string, brandPrimary: string): string {
  if (isValidHexColor(stored)) return sanitizeHexColor(stored, DEFAULT_PRIMARY_COLOR);
  return sanitizeHexColor(brandPrimary, DEFAULT_PRIMARY_COLOR);
}

function parseLetterheadMode(v: unknown): InvoiceLetterheadMode {
  return v === 'embedded_logo' ? 'embedded_logo' : 'preprinted';
}

export function sanitizeInvoiceSetup(raw: unknown): InvoiceSetupSettings {
  const d = DEFAULT_INVOICE_SETUP;
  if (!raw || typeof raw !== 'object') return { ...d };
  const o = raw as Record<string, unknown>;
  return {
    letterheadMode: parseLetterheadMode(o.letterheadMode),
    vatPin: str(o.vatPin),
    invoiceLegalName: str(o.invoiceLegalName),
    logoSrc: str(o.logoSrc),
    contactAddress: str(o.contactAddress),
    contactEmail: str(o.contactEmail),
    contactPhone: str(o.contactPhone),
    documentFooterText: str(o.documentFooterText),
    primaryColor: sanitizeInvoicePrimaryColor(o.primaryColor),
    headerBackgroundColor: sanitizeInvoicePrimaryColor(o.headerBackgroundColor),
    panelBackgroundColor: sanitizeInvoicePrimaryColor(o.panelBackgroundColor),
  };
}

export async function loadRawInvoiceSetupSettings(
  organizationId: string,
): Promise<InvoiceSetupSettings> {
  if (!process.env.DATABASE_URL) return { ...DEFAULT_INVOICE_SETUP };
  try {
    return await withOrgContext(organizationId, async (tx) => {
      const row = await tx.systemSetting.findUnique({
        where: systemSettingWhere(organizationId, INVOICE_SETUP_SETTINGS_KEY),
      });
      return row ? sanitizeInvoiceSetup(row.value) : { ...DEFAULT_INVOICE_SETUP };
    });
  } catch {
    return { ...DEFAULT_INVOICE_SETUP };
  }
}

/** Fill empty invoice fields from company setup / org name (legacy migration only). */
export async function resolveInvoiceIdentity(
  organizationId: string,
  settings: InvoiceSetupSettings,
): Promise<InvoiceSetupSettings> {
  const [company, org] = await Promise.all([
    loadCompanySetupSettingsForOrg(organizationId),
    withOrgContext(organizationId, (tx) =>
      tx.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      }),
    ),
  ]);
  const brand = resolvePublicBrand(company);
  const orgName = org?.name?.trim() ?? '';

  return {
    ...settings,
    invoiceLegalName: settings.invoiceLegalName || brand.payslipLegalName || brand.orgName || orgName,
    logoSrc:
      settings.logoSrc ||
      (isCustomLogo(brand.tenantLogoSrc) ? brand.tenantLogoSrc : ''),
    contactAddress: settings.contactAddress || brand.contactAddress,
    contactEmail: settings.contactEmail || brand.contactEmail,
    contactPhone: settings.contactPhone || brand.contactPhone,
    documentFooterText: settings.documentFooterText || brand.documentFooterText,
    primaryColor: resolveInvoicePrimaryColor(settings.primaryColor, brand.primaryColor),
    headerBackgroundColor: settings.headerBackgroundColor,
    panelBackgroundColor: settings.panelBackgroundColor,
  };
}

export function invoiceSettingsToPdfBranding(settings: InvoiceSetupSettings): InvoicePdfBranding {
  const logoUrl = settings.logoSrc.trim();
  return {
    legalName: settings.invoiceLegalName.trim(),
    address: settings.contactAddress.trim(),
    contactEmail: settings.contactEmail.trim(),
    contactPhone: settings.contactPhone.trim(),
    logoUrl,
    hasCustomLogo: isCustomLogo(logoUrl),
    documentFooter: settings.documentFooterText.trim(),
    primaryColor: settings.primaryColor,
    headerBackgroundColor: settings.headerBackgroundColor,
    panelBackgroundColor: settings.panelBackgroundColor,
    vatPin: settings.vatPin.trim(),
    letterheadMode: settings.letterheadMode,
  };
}

/** Default shaded panels on invoice PDFs (table header, invoice-to box, payment details). */
export const DEFAULT_INVOICE_PANEL_BACKGROUND = '#F3F4F6';

export function resolveInvoicePanelBackground(stored: string): string {
  if (isValidHexColor(stored)) return sanitizeHexColor(stored, DEFAULT_INVOICE_PANEL_BACKGROUND);
  return DEFAULT_INVOICE_PANEL_BACKGROUND;
}

export async function loadInvoiceSetupSettings(
  organizationId: string,
): Promise<InvoiceSetupSettings> {
  const stored = await loadRawInvoiceSetupSettings(organizationId);
  return resolveInvoiceIdentity(organizationId, stored);
}

export async function persistInvoiceSetupSettings(
  organizationId: string,
  settings: InvoiceSetupSettings,
  updatedByUserId: string | null,
): Promise<void> {
  const sanitized = sanitizeInvoiceSetup(settings);
  await withOrgContext(organizationId, async (tx) => {
    await tx.systemSetting.upsert({
      where: systemSettingWhere(organizationId, INVOICE_SETUP_SETTINGS_KEY),
      update: {
        value: sanitized as unknown as Prisma.InputJsonValue,
        updatedByUserId,
      },
      create: systemSettingCreate(
        organizationId,
        INVOICE_SETUP_SETTINGS_KEY,
        sanitized as unknown as Prisma.InputJsonValue,
        updatedByUserId,
      ),
    });
  });
}

export async function resolveInvoicePdfBranding(
  organizationId: string,
): Promise<InvoicePdfBranding> {
  const settings = await loadInvoiceSetupSettings(organizationId);
  return invoiceSettingsToPdfBranding(settings);
}

export function buildInvoiceSetupChecklist(input: {
  branding: InvoicePdfBranding;
  paymentAccountCount: number;
}): InvoiceSetupCheckItem[] {
  const { branding, paymentAccountCount } = input;
  const hasAddress = Boolean(branding.address.trim());
  const hasLegalName = Boolean(branding.legalName.trim());
  const hasVatPin = Boolean(branding.vatPin.trim());
  const hasPaymentAccount = paymentAccountCount > 0;
  const embeddedReady = branding.letterheadMode !== 'embedded_logo' || branding.hasCustomLogo;

  return [
    {
      id: 'logo',
      label: 'Company logo',
      ok: branding.hasCustomLogo,
      detail: branding.hasCustomLogo
        ? 'Custom logo configured'
        : branding.letterheadMode === 'embedded_logo'
          ? 'Upload your logo — required for embedded logo mode'
          : 'Optional for pre-printed letterhead',
      anchor: 'identity',
    },
    {
      id: 'legal-name',
      label: 'Legal / trading name',
      ok: hasLegalName,
      detail: hasLegalName ? branding.legalName : 'Set your invoice legal name',
      anchor: 'identity',
    },
    {
      id: 'address',
      label: 'Billing address',
      ok: hasAddress,
      detail: hasAddress ? branding.address : 'Add your billing address',
      anchor: 'identity',
    },
    {
      id: 'vat-pin',
      label: 'VAT PIN',
      ok: hasVatPin,
      detail: hasVatPin ? `PIN: ${branding.vatPin}` : 'Add your KRA VAT PIN for invoice PDFs',
      anchor: 'pdf-options',
    },
    {
      id: 'payment-accounts',
      label: 'Payment account',
      ok: hasPaymentAccount,
      detail: hasPaymentAccount
        ? `${paymentAccountCount} account${paymentAccountCount === 1 ? '' : 's'} configured`
        : 'Add at least one bank account for invoice PDFs',
      href: '/dashboard/accounts/payment-accounts',
    },
    {
      id: 'letterhead-mode',
      label: 'Letterhead mode',
      ok: embeddedReady,
      detail:
        branding.letterheadMode === 'embedded_logo'
          ? 'Embedded logo in PDF'
          : 'Pre-printed letterhead (blank top margin)',
      anchor: 'pdf-options',
    },
    {
      id: 'footer',
      label: 'Document footer',
      ok: Boolean(branding.documentFooter.trim()),
      detail: branding.documentFooter.trim()
        ? branding.documentFooter
        : 'Optional — registered office, company reg. no.',
      anchor: 'identity',
    },
  ];
}

export async function loadInvoiceSetupSnapshot(
  organizationId: string,
): Promise<InvoiceSetupSnapshot> {
  const [stored, effective] = await Promise.all([
    loadRawInvoiceSetupSettings(organizationId),
    loadInvoiceSetupSettings(organizationId),
  ]);
  const branding = invoiceSettingsToPdfBranding(effective);

  let paymentAccountCount = 0;
  if (process.env.DATABASE_URL) {
    paymentAccountCount = await withOrgContext(organizationId, async (tx) => {
      await ensureDefaultPaymentAccounts(tx, organizationId);
      return tx.accountsPaymentAccount.count({
        where: { organizationId, isActive: true },
      });
    });
  }

  return {
    settings: stored,
    resolved: effective,
    branding,
    checklist: buildInvoiceSetupChecklist({ branding, paymentAccountCount }),
    paymentAccountCount,
  };
}
