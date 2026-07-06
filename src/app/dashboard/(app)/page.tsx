import { Suspense } from 'react';
import DashboardOverviewContent from '@/components/dashboard/overview/DashboardOverviewContent';
import { DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

export default function DashboardOverviewPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <DashboardOverviewContent />
    </Suspense>
  );
}
