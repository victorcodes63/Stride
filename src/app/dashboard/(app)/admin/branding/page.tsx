import { BrandingPageClient } from './BrandingPageClient';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export default function BrandingPage() {
  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Branding & white-label"
        description="Identity, colours, and white-label options — gated by your subscription."
      />

      <BrandingPageClient />
    </DashboardPage>
  );
}
