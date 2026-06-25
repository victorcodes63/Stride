import type { Metadata } from 'next';

import { brandConfig } from '@/lib/brand.config';
import { getMarketingSiteUrl } from '@/lib/marketing-config';

/** Default social share image — static asset in /public/og (RAV-48). */
export const MARKETING_OG_IMAGE = {
  url: '/og/stride-default.png',
  width: 1200,
  height: 630,
  alt: `${brandConfig.productName} — ${brandConfig.tagline}`,
} as const;

type MarketingMetadataInput = {
  /** Page title (template adds product name when omitted from title string). */
  title: string;
  description: string;
  /** Canonical path, e.g. `/pricing`. */
  path: string;
  image?: typeof MARKETING_OG_IMAGE;
};

/**
 * Marketing-page metadata with canonical + Open Graph + Twitter cards.
 * Uses `NEXT_PUBLIC_SITE_URL` via `getMarketingSiteUrl()` for absolute URLs.
 */
export function marketingMetadata({
  title,
  description,
  path,
  image = MARKETING_OG_IMAGE,
}: MarketingMetadataInput): Metadata {
  const siteUrl = getMarketingSiteUrl();
  const canonical = path.startsWith('/') ? path : `/${path}`;
  const ogTitle = title.includes(brandConfig.productName) ? title : `${title} | ${brandConfig.productName}`;

  return {
    title,
    description,
    metadataBase: new URL(siteUrl),
    alternates: { canonical },
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
