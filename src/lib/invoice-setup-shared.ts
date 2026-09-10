/**
 * Client-safe invoice setup types and helpers.
 * Keep Prisma / org-context I/O in `@/lib/invoice-setup` so client pages never pull the datamodel.
 */

import { DEFAULT_PRIMARY_COLOR, isValidHexColor, sanitizeHexColor } from '@/lib/brand-theme';

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

/** Default shaded panels on invoice PDFs (table header, invoice-to box, payment details). */
export const DEFAULT_INVOICE_PANEL_BACKGROUND = '#F3F4F6';

export function resolveInvoicePanelBackground(stored: string): string {
  if (isValidHexColor(stored)) return sanitizeHexColor(stored, DEFAULT_INVOICE_PANEL_BACKGROUND);
  return DEFAULT_INVOICE_PANEL_BACKGROUND;
}
