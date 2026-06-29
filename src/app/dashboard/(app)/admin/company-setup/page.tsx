import { CompanySetupPageClient } from './CompanySetupPageClient';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export default function CompanySetupPage() {
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
