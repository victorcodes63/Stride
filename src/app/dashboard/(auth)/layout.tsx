import type { Metadata, Viewport } from 'next';
import PublicAppShell from '@/components/public/PublicAppShell';
import { studioCraftBrandVars } from '@/components/marketing/v3/StudioCraftShell';
import { DEFAULT_PRIMARY_COLOR } from '@/lib/brand-theme';

export const viewport: Viewport = {
  themeColor: DEFAULT_PRIMARY_COLOR,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Stride',
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicAppShell
      className="bg-[var(--sc-ink)] font-[var(--font-inter)] text-[var(--sc-paper)] antialiased"
      style={studioCraftBrandVars}
    >
      {children}
    </PublicAppShell>
  );
}
