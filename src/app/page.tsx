import type { Metadata } from 'next';

import { MarketingShell } from '@/components/marketing/MarketingShell';
import { StudioCraftHomePage } from '@/components/marketing/v3/StudioCraftHomePage';
import { marketingMetadata } from '@/lib/marketing-metadata';

export const metadata: Metadata = marketingMetadata({
  title: 'Payroll & HR Software in Kenya — Stride',
  description:
    'Payroll, HR and finance software for Kenyan businesses. PAYE, NSSF, SHIF and Housing Levy on every payslip, M-Pesa salary payouts and iTax-ready returns. From KES 350 per employee.',
  path: '/',
});

export default function Home() {
  return (
    <MarketingShell navOverlay>
      <StudioCraftHomePage />
    </MarketingShell>
  );
}
