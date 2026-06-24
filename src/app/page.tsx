import type { Metadata } from 'next';

import { MarketingShell } from '@/components/marketing/MarketingShell';
import { StudioCraftHomePage } from '@/components/marketing/v3/StudioCraftHomePage';

export const metadata: Metadata = {
  title: 'Stride — Move your business forward',
  description:
    'HR, finance, procurement, legal, projects and admin on one platform built for East African businesses. M-Pesa native. Compliance first.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Stride — Move your business forward',
    description:
      'HR, finance, procurement, legal, projects and admin on one platform built for East African businesses.',
    url: '/',
    type: 'website',
  },
};

export default function Home() {
  return (
    <MarketingShell navOverlay>
      <StudioCraftHomePage />
    </MarketingShell>
  );
}
