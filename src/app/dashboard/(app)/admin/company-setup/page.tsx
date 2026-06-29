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
        description="Branding, sign-in, and workspace defaults for your company. Changes apply after you save — no redeploy required."
      />

      <CompanySetupPageClient />
    </DashboardPage>
  );
}
