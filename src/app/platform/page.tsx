import { MarketingShell } from '@/components/marketing/MarketingShell';
import { PlatformPageContent } from '@/components/marketing/platform/PlatformPageContent';
import { marketingMetadata } from '@/lib/marketing-metadata';

/**
 * Lives outside the (marketing) route group so it controls its own shell;
 * the hero is light, so the nav renders as a solid bar.
 */
export const metadata = marketingMetadata({
  title: 'HR, Payroll & Finance Software Modules | Stride Platform',
  description:
    'Explore the Stride platform: HR & payroll and finance on every plan, plug-in modules for procurement, legal, projects and admin, and industry packs. PAYE, NSSF, SHIF, Housing Levy and M-Pesa built in.',
  path: '/platform',
});

export default function PlatformPage() {
  return (
    <MarketingShell>
      <PlatformPageContent />
    </MarketingShell>
  );
}
