import type { MetadataRoute } from 'next';
import { brand } from '@/lib/brand';

import {
  STRIDE_MANIFEST_BACKGROUND,
  STRIDE_MANIFEST_THEME_COLOR,
} from '@/lib/stride-palette';

/** PWA manifest — icons follow `brand.logoSrc` (same asset as dashboard sidebar / metadata). */
export default function manifest(): MetadataRoute.Manifest {
  const logoPath = brand.logoSrc.startsWith('/') ? brand.logoSrc : `/${brand.logoSrc}`;
  const isSvg = logoPath.endsWith('.svg');
  return {
    name: brand.appName,
    short_name: brand.appName,
    description: `${brand.orgName} — ${brand.tagline}`,
    start_url: '/',
    display: 'standalone',
    background_color: STRIDE_MANIFEST_BACKGROUND,
    theme_color: STRIDE_MANIFEST_THEME_COLOR,
    icons: [
      {
        src: logoPath,
        sizes: 'any',
        type: isSvg ? 'image/svg+xml' : 'image/png',
      },
    ],
  };
}
