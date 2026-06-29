import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INVOICE_SETUP,
  resolveInvoicePrimaryColor,
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
