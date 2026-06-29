import type { Prisma } from '@prisma/client';
import { withOrgContext } from '@/lib/org-context';
import { loadCompanySetupSettingsForOrg } from '@/lib/company-setup';
import { resolvePublicBrand, isCustomLogo } from '@/lib/resolve-public-brand';
import {
  systemSettingCreate,
  systemSettingWhere,
} from '@/lib/system-setting-store';
import { DEFAULT_PRIMARY_COLOR } from '@/lib/brand-theme';
import { ensureDefaultPaymentAccounts } from '@/lib/payment-accounts';

export const INVOICE_SETUP_SETTINGS_KEY = 'accounts.invoice.setup';

export type InvoiceLetterheadMode = 'preprinted' | 'embedded_logo';

export type InvoiceSetupSettings = {
  letterheadMode: InvoiceLetterheadMode;
  vatPin: string;
  /** Optional override for the legal name shown on invoice PDFs. */
  invoiceLegalName: string;
};

export const DEFAULT_INVOICE_SETUP: InvoiceSetupSettings = {
  letterheadMode: 'preprinted',
  vatPin: '',
  invoiceLegalName: '',
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
  vatPin: string;
  letterheadMode: InvoiceLetterheadMode;
};

export type InvoiceSetupCheckItem = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  href?: string;
};

export type InvoiceSetupSnapshot = {
  settings: InvoiceSetupSettings;
  branding: InvoicePdfBranding;
  checklist: InvoiceSetupCheckItem[];
  paymentAccountCount: number;
  companyIdentity: {
    orgName: string;
    contactAddress: string;
    contactEmail: string;
    contactPhone: string;
    logoSrc: string;
    documentFooterText: string;
    primaryColor: string;
  };
};

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
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
  };
}

export async function loadInvoiceSetupSettings(
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

export async function persistInvoiceSetupSettings(
  organizationId: string,
  settings: InvoiceSetupSettings,
  updatedByUserId: string | null,
): Promise<void> {
  await withOrgContext(organizationId, async (tx) => {
    await tx.systemSetting.upsert({
      where: systemSettingWhere(organizationId, INVOICE_SETUP_SETTINGS_KEY),
      update: {
        value: settings as unknown as Prisma.InputJsonValue,
        updatedByUserId,
      },
      create: systemSettingCreate(
        organizationId,
        INVOICE_SETUP_SETTINGS_KEY,
        settings as unknown as Prisma.InputJsonValue,
        updatedByUserId,
      ),
    });
  });
}

export async function resolveInvoicePdfBranding(
  organizationId: string,
): Promise<InvoicePdfBranding> {
  const [setup, invoiceSetup] = await Promise.all([
    loadCompanySetupSettingsForOrg(organizationId),
    loadInvoiceSetupSettings(organizationId),
  ]);
  const brand = resolvePublicBrand(setup);
  const legalName =
    invoiceSetup.invoiceLegalName.trim() ||
    brand.payslipLegalName.trim() ||
    brand.orgName.trim();

  return {
    legalName,
    address: brand.contactAddress,
    contactEmail: brand.contactEmail,
    contactPhone: brand.contactPhone,
    logoUrl: brand.tenantLogoSrc,
    hasCustomLogo: isCustomLogo(brand.tenantLogoSrc),
    documentFooter: brand.documentFooterText,
    primaryColor: brand.primaryColor || DEFAULT_PRIMARY_COLOR,
    vatPin: invoiceSetup.vatPin,
    letterheadMode: invoiceSetup.letterheadMode,
  };
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
          : 'Optional for pre-printed letterhead — upload in Company setup',
      href: '/dashboard/admin/company-setup',
    },
    {
      id: 'legal-name',
      label: 'Legal / trading name',
      ok: hasLegalName,
      detail: hasLegalName ? branding.legalName : 'Set organisation or invoice legal name',
      href: '/dashboard/admin/company-setup',
    },
    {
      id: 'address',
      label: 'Billing address',
      ok: hasAddress,
      detail: hasAddress ? branding.address : 'Add contact address in Company setup',
      href: '/dashboard/admin/company-setup',
    },
    {
      id: 'vat-pin',
      label: 'VAT PIN',
      ok: hasVatPin,
      detail: hasVatPin ? `PIN: ${branding.vatPin}` : 'Add your KRA VAT PIN for invoice PDFs',
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
    },
    {
      id: 'footer',
      label: 'Document footer',
      ok: Boolean(branding.documentFooter.trim()),
      detail: branding.documentFooter.trim()
        ? branding.documentFooter
        : 'Optional — registered office, company reg. no.',
      href: '/dashboard/admin/company-setup',
    },
  ];
}

export async function loadInvoiceSetupSnapshot(
  organizationId: string,
): Promise<InvoiceSetupSnapshot> {
  const [setup, invoiceSettings, branding] = await Promise.all([
    loadCompanySetupSettingsForOrg(organizationId),
    loadInvoiceSetupSettings(organizationId),
    resolveInvoicePdfBranding(organizationId),
  ]);
  const brand = resolvePublicBrand(setup);

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
    settings: invoiceSettings,
    branding,
    checklist: buildInvoiceSetupChecklist({ branding, paymentAccountCount }),
    paymentAccountCount,
    companyIdentity: {
      orgName: brand.orgName,
      contactAddress: brand.contactAddress,
      contactEmail: brand.contactEmail,
      contactPhone: brand.contactPhone,
      logoSrc: brand.tenantLogoSrc,
      documentFooterText: brand.documentFooterText,
      primaryColor: brand.primaryColor,
    },
  };
}
