import PublicAppShell from '@/components/public/PublicAppShell';
import { MARKETING_BRAND } from '@/lib/marketing-config';
import '@/styles/marketing-mobile.css';

const brandVars = {
  '--sc-coral': MARKETING_BRAND.coral,
  '--sc-coral-deep': MARKETING_BRAND.coralDeep,
  '--sc-ink': MARKETING_BRAND.ink,
  '--sc-ink-muted': MARKETING_BRAND.inkMuted,
  '--sc-paper': MARKETING_BRAND.paper,
  '--sc-paper-2': MARKETING_BRAND.paper2,
  '--sc-line': MARKETING_BRAND.line,
} as React.CSSProperties;

export default function FullscreenMarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicAppShell
      className="studio-craft-marketing max-w-[100vw] overflow-x-clip bg-[var(--sc-ink)] font-[var(--font-inter)] text-[var(--sc-paper)] antialiased"
      style={brandVars}
    >
      {children}
    </PublicAppShell>
  );
}
