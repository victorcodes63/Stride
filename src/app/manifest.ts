import type { MetadataRoute } from 'next';
import { brand } from '@/lib/brand';
import { isPublicDemoMode } from '@/lib/deployment-flags';

import {
  STRIDE_MANIFEST_BACKGROUND,
  STRIDE_MANIFEST_THEME_COLOR,
} from '@/lib/stride-palette';

/** PWA manifest — icons from official logo kit PNG exports. */
export default function manifest(): MetadataRoute.Manifest {
  // Demo cells are mostly shown as employee portal; avoid opening staff login from the home-screen icon.
  const demoEss = isPublicDemoMode();

  return {
    id: demoEss ? '/ess' : '/',
    name: demoEss ? `${brand.appName} — Employee` : brand.appName,
    short_name: demoEss ? 'Stride ESS' : brand.appName,
    description: demoEss
      ? `${brand.orgName} employee self-service`
      : `${brand.orgName} — ${brand.tagline}`,
    start_url: demoEss ? '/ess/login' : '/',
    scope: demoEss ? '/ess' : '/',
    display: 'standalone',
    background_color: STRIDE_MANIFEST_BACKGROUND,
    theme_color: STRIDE_MANIFEST_THEME_COLOR,
    icons: [
      {
        src: demoEss ? '/icons/ess-192.svg' : '/brand/stride-mark-192.png',
        sizes: '192x192',
        type: demoEss ? 'image/svg+xml' : 'image/png',
      },
      {
        src: demoEss ? '/icons/ess-512.svg' : '/brand/stride-mark-512.png',
        sizes: '512x512',
        type: demoEss ? 'image/svg+xml' : 'image/png',
      },
      ...(demoEss
        ? []
        : [
            {
              src: '/brand/stride-mark.svg',
              sizes: 'any',
              type: 'image/svg+xml',
            },
          ]),
    ],
    shortcuts: demoEss
      ? [
          { name: 'Request leave', short_name: 'Leave', url: '/ess/leave' },
          { name: 'Payslips', short_name: 'Pay', url: '/ess/payslips' },
        ]
      : [
          {
            name: 'Employee Self Service',
            short_name: 'ESS',
            url: '/ess/login',
          },
          {
            name: 'Staff dashboard',
            short_name: 'Staff',
            url: '/dashboard/login',
          },
        ],
  };
}
