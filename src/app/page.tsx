import type { Metadata } from 'next';

import { MarketingShell } from '@/components/marketing/MarketingShell';
import { StudioCraftHomePage } from '@/components/marketing/v3/StudioCraftHomePage';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata: Metadata = marketingMetadata({
  title: 'Stride — Operations platform for East African businesses',
  description:
    'One operations platform: HR & payroll plus finance at the core, with plug-in modules and industry packs. Built for East Africa — M-Pesa native, compliance-ready.',
  path: '/',
});

export default function Home() {
  return (
    <MarketingShell navOverlay>
      <StudioCraftHomePage />
    </MarketingShell>
  );
}
