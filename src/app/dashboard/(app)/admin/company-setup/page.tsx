import { canAccessCompanySetup } from '@/lib/deployment-tier';
import { CompanySetupPageClient } from './CompanySetupPageClient';
import { CompanySetupTierGate } from './CompanySetupTierGate';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export default function CompanySetupPage() {
  if (!canAccessCompanySetup()) {
    return <CompanySetupTierGate />;
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Company setup"
        description="Branding, login experience, careers page, and dashboard defaults for this deployment. Changes apply immediately after you save — no redeploy required."
      />

      <CompanySetupPageClient />
    </DashboardPage>
  );
}
