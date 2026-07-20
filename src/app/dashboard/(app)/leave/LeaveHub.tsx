'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { DashboardPage } from '@/components/dashboard/DashboardPage';

/**
 * People & HR → Leave is scoped to INTERNAL staff only. The outsourced
 * workforce leave lives under HR Outsourcing (/dashboard/outsourcing/leave).
 * This route now redirects to the internal staff leave surface.
 */
export default function LeaveHubPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/staff-leave');
  }, [router]);

  return (
    <DashboardPage>
      <div className="py-16 text-center text-sm text-neutral-500">Opening staff leave…</div>
    </DashboardPage>
  );
}
