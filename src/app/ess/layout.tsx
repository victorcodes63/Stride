import type { Metadata, Viewport } from 'next';
import { brand } from '@/lib/brand';
import { DEFAULT_SECONDARY_COLOR } from '@/lib/brand-theme';

export const metadata: Metadata = {
  title: {
    default: `${brand.appName} — Employee`,
    template: `%s | ${brand.appName}`,
  },
  description: `${brand.orgName} employee self-service portal`,
  manifest: '/api/ess/manifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'My HR',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: DEFAULT_SECONDARY_COLOR,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function EssRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
