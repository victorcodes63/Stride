import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export default function TasksPage() {
  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={ClipboardList}
        title="Tasks"
        description="Task assignment lives in the onboarding workspace."
      />
      <div className="dashboard-surface p-8 text-center text-neutral-600 text-sm mt-6">
        <p className="mb-3">Open workflows, templates, and assigned tasks from the onboarding module.</p>
        <Link href="/dashboard/onboarding" className="inline-flex rounded-md bg-primary-900 px-4 py-2 text-white">
          Go to onboarding
        </Link>
      </div>
    </DashboardPage>
  );
}
