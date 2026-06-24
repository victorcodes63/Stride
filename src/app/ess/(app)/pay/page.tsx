'use client';

import { ESS_PAY_HUB_TILES } from '@/lib/ess-nav-catalog';
import { EssHubPage } from '@/components/ess/EssHubPage';

export default function EssPayHubPage() {
  return (
    <EssHubPage
      title="Pay"
      subtitle="Payslips, tax, and bank details"
      tiles={ESS_PAY_HUB_TILES}
      backHref="/ess"
    />
  );
}
