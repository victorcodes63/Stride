import { MarketingShell } from '@/components/marketing/MarketingShell';
import { MarketingAnalytics } from '@/components/marketing/MarketingAnalytics';
import { marketingMetadata } from '@/lib/marketing-metadata';

/**
 * Shell-level marketing fallback. Child pages should call marketingMetadata()
 * with their own path; this catches any future (marketing) page that forgets.
 */
export const metadata = marketingMetadata({
  title: 'Stride — Operations platform for East African businesses',
  description:
    'One operations platform: HR & payroll plus finance at the core, with plug-in modules and industry packs. Built for East Africa — M-Pesa native, compliance-ready.',
  path: '/',
});

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingShell>
      <MarketingAnalytics />
      {children}
    </MarketingShell>
  );
}
