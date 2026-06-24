import { TrendingUp } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export default function PerformancePage() {
  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={TrendingUp}
        title="Performance management"
        description="Goals, reviews, and cycles (coming next)."
      />
      <div className="dashboard-surface border-dashed p-8 text-center text-neutral-500 text-sm mt-6">
        Placeholder. Add review cycles, OKRs, or 1:1 notes here.
      </div>
    </DashboardPage>
  );
}
