import type { Metadata } from 'next';
import { PackageCheck } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardEmptyState } from '@/components/dashboard/DashboardAsyncState';

export const metadata: Metadata = {
  title: 'Receiving | Stride (Procurement)',
};

export default function ProcurementReceivingPage() {
  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Receiving"
        eyebrow="Procurement"
        icon={PackageCheck}
        description="Goods receipt notes, 3-way matching, and receiving controls."
      />
      <div className="dashboard-surface overflow-hidden">
        <DashboardEmptyState
          icon={PackageCheck}
          title="Receiving is being built"
          description="Goods receipt (GRN) capture, 3-way match against POs, and returns are coming soon."
        />
      </div>
    </DashboardPage>
  );
}
