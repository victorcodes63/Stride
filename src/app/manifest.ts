import type { MetadataRoute } from 'next';
import { brand } from '@/lib/brand';

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
    background_color: '#FBF8F4',
    theme_color: '#1A1714',
    icons: [
      {
        src: logoPath,
        sizes: 'any',
        type: isSvg ? 'image/svg+xml' : 'image/png',
      },
    ],
  };
}
