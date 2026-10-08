import type { Metadata } from 'next';

import { brandConfig } from '@/lib/brand.config';
import { getMarketingSiteUrl } from '@/lib/marketing-config';

/** Default social share image — static asset in /public/og (RAV-48). */
export const MARKETING_OG_IMAGE = {
  url: '/og/stride-default.png',
  width: 1200,
  height: 630,
  alt: `${brandConfig.productName}, ${brandConfig.tagline}`,
} as const;

/** Primary commercial keywords for Kenya / East Africa marketing pages. */
export const MARKETING_PRIMARY_KEYWORDS = [
  'HRIS Kenya',
  'HRMS Kenya',
  'payroll software Kenya',
  'HR software Kenya',
  'PAYE NSSF SHIF',
  'Housing Levy payroll',
  'M-Pesa payroll',
  'iTax payroll software',
  'HRIS East Africa',
  'Stride HR',
] as const;

type MarketingMetadataInput = {
  /** Page title segment only — root layout appends `| Stride`. Do not include the product name. */
  title: string;
  description: string;
  /** Canonical path, e.g. `/pricing`. */
  path: string;
  image?: typeof MARKETING_OG_IMAGE;
  keywords?: readonly string[];
  robots?: Metadata['robots'];
};

function stripProductSuffix(title: string): string {
  const suffix = new RegExp(`\\s*[|–—-]\\s*${brandConfig.productName}\\s*$`, 'i');
  return title.replace(suffix, '').trim();
}

/**
 * Marketing-page metadata with canonical + Open Graph + Twitter cards.
 * Uses `NEXT_PUBLIC_SITE_URL` via `getMarketingSiteUrl()` for absolute URLs.
 */
export function marketingMetadata({
  title,
  description,
  path,
  image = MARKETING_OG_IMAGE,
  keywords,
  robots,
}: MarketingMetadataInput): Metadata {
  const siteUrl = getMarketingSiteUrl();
  const canonical = path.startsWith('/') ? path : `/${path}`;
  const pageTitle = stripProductSuffix(title);
  const ogTitle = `${pageTitle} | ${brandConfig.productName}`;

  return {
    title: pageTitle,
    description,
    keywords: keywords ? [...keywords] : undefined,
    metadataBase: new URL(siteUrl),
    alternates: { canonical },
    ...(robots ? { robots } : {}),
    openGraph: {
      title: ogTitle,
      description,
      url: canonical,
      siteName: brandConfig.productName,
      images: [image],
      locale: 'en_KE',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: [image.url],
    },
  };
}
