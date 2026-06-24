import PublicAppShell from '@/components/public/PublicAppShell';
import { studioCraftBrandVars } from '@/components/marketing/v3/StudioCraftShell';

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
