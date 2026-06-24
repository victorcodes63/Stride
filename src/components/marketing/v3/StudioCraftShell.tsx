import type { CSSProperties, ReactNode } from 'react';

import PublicAppShell from '@/components/public/PublicAppShell';
import { MARKETING_BRAND } from '@/lib/marketing-config';
import '@/styles/marketing-mobile.css';

export const studioCraftBrandVars = {
  '--sc-coral': MARKETING_BRAND.coral,
  '--sc-coral-deep': MARKETING_BRAND.coralDeep,
  '--sc-ink': MARKETING_BRAND.ink,
  '--sc-ink-muted': MARKETING_BRAND.inkMuted,
  '--sc-paper': MARKETING_BRAND.paper,
  '--sc-paper-2': MARKETING_BRAND.paper2,
  '--sc-line': MARKETING_BRAND.line,
} as CSSProperties;

type StudioCraftShellProps = {
  children: ReactNode;
};

/** Shared wrapper for studio-craft marketing pages (v3 direction). */
export function StudioCraftShell({ children }: StudioCraftShellProps) {
  return (
    <PublicAppShell
      className="studio-craft-marketing max-w-[100vw] bg-[var(--sc-paper)] font-[var(--font-inter)] text-[var(--sc-ink-muted)]"
      style={studioCraftBrandVars}
    >
      {children}
    </PublicAppShell>
  );
}
