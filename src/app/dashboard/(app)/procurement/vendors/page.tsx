import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardEmptyState } from '@/components/dashboard/DashboardAsyncState';

export const metadata: Metadata = {
  title: 'Vendors | Stride (Procurement)',
};

export default function ProcurementVendorsPage() {
  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Vendors"
        eyebrow="Procurement"
        icon={Building2}
        description="Vendor directory, performance, and procurement relationships. Vendor master is shared with Finance."
      />
      <div className="dashboard-surface overflow-hidden">
        <DashboardEmptyState
          icon={Building2}
          title="Vendors is being built"
          description="A procurement-focused vendor directory and scorecard view is coming soon."
        />
      </div>
    </DashboardPage>
  );
}
