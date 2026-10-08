import type { Metadata, Viewport } from 'next';
import PublicAppShell from '@/components/public/PublicAppShell';
import { ForceLightTheme } from '@/components/auth/ForceLightTheme';
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
    statusBarStyle: 'default',
    title: 'Stride',
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicAppShell
      className="bg-white font-[var(--font-jakarta)] text-[var(--sc-ink)] antialiased"
      style={studioCraftBrandVars}
    >
      {/* Before paint: strip dashboard dark class so email/password fields stay white. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';}catch(e){}})();",
        }}
      />
      <ForceLightTheme>{children}</ForceLightTheme>
    </PublicAppShell>
  );
}
