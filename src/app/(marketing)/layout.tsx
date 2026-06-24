import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Stride — Operations platform for East African businesses',
  description:
    'Hit your stride. HR, finance, procurement, legal, projects and admin on one platform — M-Pesa native, compliance-ready.',
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
