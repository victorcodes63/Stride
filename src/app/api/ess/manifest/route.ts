import { NextResponse } from 'next/server';
import { brand } from '@/lib/brand';
import { DEFAULT_SECONDARY_COLOR } from '@/lib/brand-theme';

export async function GET() {
  const manifest = {
    name: `${brand.appName} — Employee`,
    short_name: 'My HR',
    description: `${brand.orgName} employee self-service`,
    start_url: '/ess',
    scope: '/ess',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: DEFAULT_SECONDARY_COLOR,
    background_color: '#0f172a',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/ess-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/ess-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/ess-maskable.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Request leave', short_name: 'Leave', url: '/ess/leave' },
      { name: 'Payslips', short_name: 'Pay', url: '/ess/payslips' },
      { name: 'Clock in', short_name: 'Clock', url: '/ess/attendance/clock' },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
