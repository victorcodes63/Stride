import type { MetadataRoute } from 'next';
import { brand } from '@/lib/brand';

import {
  STRIDE_MANIFEST_BACKGROUND,
  STRIDE_MANIFEST_THEME_COLOR,
} from '@/lib/stride-palette';

/** PWA manifest — icons from official logo kit PNG exports. */
export default function manifest(): MetadataRoute.Manifest {
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
        src: '/brand/stride-mark-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/brand/stride-mark-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/brand/stride-mark.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
