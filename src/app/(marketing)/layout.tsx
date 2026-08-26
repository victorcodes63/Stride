import { MarketingShell } from '@/components/marketing/MarketingShell';
import { marketingMetadata } from '@/lib/marketing-metadata';

/**
 * Shell-level marketing fallback. Child pages should call marketingMetadata()
 * with their own path; this catches any future (marketing) page that forgets.
 */
export const metadata = marketingMetadata({
  title: 'Stride — Operations platform for East African businesses',
  description:
    'Hit your stride. HR, finance, procurement, legal, projects and admin on one platform — M-Pesa native, compliance-ready.',
  path: '/',
});

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
