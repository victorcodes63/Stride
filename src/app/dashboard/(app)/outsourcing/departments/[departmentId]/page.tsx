import { Suspense } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DepartmentDetailView } from '@/components/outsourcing/DepartmentDetailView';

export default async function OutsourcingDepartmentDetailPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = await params;
  return (
    <Suspense
      fallback={
        <DashboardPage>
          <div className="dashboard-surface h-40 animate-pulse shadow-sm" />
        </DashboardPage>
      }
    >
      <DepartmentDetailView departmentId={departmentId} backHref="/dashboard/outsourcing/departments" />
    </Suspense>
  );
}
