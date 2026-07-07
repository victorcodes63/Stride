import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INVOICE_SETUP,
  invoiceSettingsToPdfBranding,
  resolveInvoicePrimaryColor,
  resolveLetterheadModeForStyle,
  sanitizeInvoicePrimaryColor,
  sanitizeInvoiceSetup,
} from './invoice-setup';

describe('invoice-setup primaryColor', () => {
  it('stores empty string when accent colour is unset', () => {
    expect(sanitizeInvoiceSetup({}).primaryColor).toBe('');
    expect(sanitizeInvoiceSetup({ primaryColor: '' }).primaryColor).toBe('');
    expect(DEFAULT_INVOICE_SETUP.primaryColor).toBe('');
  });

  it('persists black (#000000) without falling back to default coral', () => {
    expect(sanitizeInvoicePrimaryColor('#000000')).toBe('#000000');
    expect(sanitizeInvoiceSetup({ primaryColor: '#000000' }).primaryColor).toBe('#000000');
    expect(resolveInvoicePrimaryColor('#000000', '#FF5436')).toBe('#000000');
  });

  it('inherits company colour when invoice accent is unset', () => {
    expect(resolveInvoicePrimaryColor('', '#FF5436')).toBe('#FF5436');
  });

  it('rejects invalid hex without storing default coral', () => {
    expect(sanitizeInvoicePrimaryColor('not-a-color')).toBe('');
    expect(sanitizeInvoicePrimaryColor('#abc')).toBe('');
  });
});

describe('invoice-setup invoiceStyle', () => {
  it('defaults to plain style', () => {
    expect(sanitizeInvoiceSetup({}).invoiceStyle).toBe('plain');
    expect(DEFAULT_INVOICE_SETUP.invoiceStyle).toBe('plain');
  });

  it('migrates legacy embedded_logo to branded style', () => {
    expect(sanitizeInvoiceSetup({ letterheadMode: 'embedded_logo' }).invoiceStyle).toBe('branded');
  });

  it('aligns letterhead mode with invoice style', () => {
    expect(resolveLetterheadModeForStyle('plain', 'embedded_logo')).toBe('preprinted');
    expect(resolveLetterheadModeForStyle('branded', 'preprinted')).toBe('embedded_logo');
    expect(sanitizeInvoiceSetup({ invoiceStyle: 'plain' }).letterheadMode).toBe('preprinted');
    expect(sanitizeInvoiceSetup({ invoiceStyle: 'branded' }).letterheadMode).toBe('embedded_logo');
  });

  it('strips branding colours from plain PDF branding', () => {
    const branding = invoiceSettingsToPdfBranding(
      sanitizeInvoiceSetup({
        invoiceStyle: 'plain',
        primaryColor: '#FF5436',
        headerBackgroundColor: '#000000',
        panelBackgroundColor: '#E8F4FC',
      }),
    );
    expect(branding.invoiceStyle).toBe('plain');
    expect(branding.primaryColor).toBe('');
    expect(branding.headerBackgroundColor).toBe('');
    expect(branding.panelBackgroundColor).toBe('');
    expect(branding.letterheadMode).toBe('preprinted');
  });
});
