import type { Prisma } from '@prisma/client';
import { withOrgContext } from '@/lib/org-context';
import { resolvePublicBrand, isCustomLogo } from '@/lib/resolve-public-brand';
import {
  systemSettingCreate,
  systemSettingWhere,
} from '@/lib/system-setting-store';
import { DEFAULT_PRIMARY_COLOR, isValidHexColor, sanitizeHexColor } from '@/lib/brand-theme';
import { ensureDefaultPaymentAccounts } from '@/lib/payment-accounts';

export const INVOICE_SETUP_SETTINGS_KEY = 'accounts.invoice.setup';

export type InvoiceLetterheadMode = 'preprinted' | 'embedded_logo';

/** Plain = monochrome grey layout with letterhead top padding; branded = logo + optional colours. */
export type InvoiceStyle = 'plain' | 'branded';

export type InvoiceSetupSettings = {
  /** Preferred PDF layout style (plain letterhead-friendly vs branded with logo). */
  invoiceStyle: InvoiceStyle;
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
  invoiceStyle: 'plain',
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
  invoiceStyle: InvoiceStyle;
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

function parseInvoiceStyle(v: unknown, letterheadMode: InvoiceLetterheadMode): InvoiceStyle {
  if (v === 'plain' || v === 'branded') return v;
  return letterheadMode === 'embedded_logo' ? 'branded' : 'plain';
}

/** Keep letterhead mode aligned with the selected invoice style. */
export function resolveLetterheadModeForStyle(
  invoiceStyle: InvoiceStyle,
  letterheadMode: InvoiceLetterheadMode,
): InvoiceLetterheadMode {
  if (invoiceStyle === 'plain') return 'preprinted';
  if (invoiceStyle === 'branded') return 'embedded_logo';
  return letterheadMode;
}

export function sanitizeInvoiceSetup(raw: unknown): InvoiceSetupSettings {
  const d = DEFAULT_INVOICE_SETUP;
  if (!raw || typeof raw !== 'object') return { ...d };
  const o = raw as Record<string, unknown>;
  const letterheadMode = parseLetterheadMode(o.letterheadMode);
  const invoiceStyle = parseInvoiceStyle(o.invoiceStyle, letterheadMode);
  return {
    invoiceStyle,
    letterheadMode: resolveLetterheadModeForStyle(invoiceStyle, letterheadMode),
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
  const { loadCompanySetupSettingsForOrg } = await import('@/lib/company-setup');
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
  const invoiceStyle = settings.invoiceStyle;
  const letterheadMode = resolveLetterheadModeForStyle(invoiceStyle, settings.letterheadMode);
  return {
    legalName: settings.invoiceLegalName.trim(),
    address: settings.contactAddress.trim(),
    contactEmail: settings.contactEmail.trim(),
    contactPhone: settings.contactPhone.trim(),
    logoUrl,
    hasCustomLogo: isCustomLogo(logoUrl),
    documentFooter: settings.documentFooterText.trim(),
    primaryColor: invoiceStyle === 'plain' ? '' : settings.primaryColor,
    headerBackgroundColor: invoiceStyle === 'plain' ? '' : settings.headerBackgroundColor,
    panelBackgroundColor: invoiceStyle === 'plain' ? '' : settings.panelBackgroundColor,
    vatPin: settings.vatPin.trim(),
    letterheadMode,
    invoiceStyle,
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
  const embeddedReady =
    branding.invoiceStyle !== 'branded' || branding.hasCustomLogo;

  return [
    {
      id: 'logo',
      label: 'Company logo',
      ok: branding.invoiceStyle === 'plain' || branding.hasCustomLogo,
      detail:
        branding.invoiceStyle === 'plain'
          ? 'Not used on plain invoices — use pre-printed letterhead instead'
          : branding.hasCustomLogo
            ? 'Custom logo configured for branded PDFs'
            : 'Upload your logo for branded invoice PDFs',
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
      id: 'invoice-style',
      label: 'Invoice style',
      ok: embeddedReady,
      detail:
        branding.invoiceStyle === 'branded'
          ? branding.hasCustomLogo
            ? 'Branded PDF with embedded logo'
            : 'Branded PDF — upload a logo to complete setup'
          : 'Plain PDF — grey lines only, space for pre-printed letterhead',
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
