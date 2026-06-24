/**
 * Stride product identity — fixed platform brand (not tenant-configurable).
 * Tenant org names, logos, and copy are configured in Admin → Company Setup (dashboard only).
 */

export const STRIDE_PRODUCT_NAME = 'Stride';
/** @deprecated Internal alias — use {@link STRIDE_PRODUCT_NAME}. */
export const IMARA_PRODUCT_NAME = STRIDE_PRODUCT_NAME;
export const IMARA_PRODUCT_DESCRIPTOR = 'Operations platform for East African businesses';

import { STRIDE_BRAND_PRIMARY, STRIDE_BRAND_SECONDARY } from '@/lib/stride-palette';

export const brandConfig = {
  productName: STRIDE_PRODUCT_NAME,
  productDescriptor: IMARA_PRODUCT_DESCRIPTOR,
  companyLegal: 'Raven Tech Group',
  beachhead: 'sacco' as const,
  tagline:
    'Hit your stride. HR, finance, and operations on one platform — built for East African businesses.',
  shortTagline: 'People, payroll, and operations — M-Pesa-native, compliance-ready.',
  theme: {
    primary: STRIDE_BRAND_PRIMARY,
    secondary: STRIDE_BRAND_SECONDARY,
  },
  demo: {
    saccoOrgName: 'Heritage Members SACCO Ltd',
    saccoTagline:
      'Member-trusted payroll and workforce operations — compliant, M-Pesa-native, board-ready.',
  },
  supportEmail: 'hello@getstride.co.ke',
} as const;

export type BrandConfig = typeof brandConfig;
