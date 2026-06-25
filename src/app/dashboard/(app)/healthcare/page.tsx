'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

type Overview = {
  summary: {
    activeWards: number;
    upcomingClinicalShifts: number;
    licenseGaps: number;
    nhifCompliancePct: number;
  };
};

export default function HealthcareOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/healthcare/overview')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to load');
        setData(json as Overview);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardPageSkeleton />;
  if (error || !data) {
    return (
      <DashboardPage>
        <DashboardAsyncState variant="error" title="Healthcare" message={error ?? 'Unknown error'} />
      </DashboardPage>
    );
  }

  const { summary } = data;

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Healthcare vertical"
        title="Clinical operations"
        description="Ward rules, licence-gated rota, and NHIF/SHIF compliance on the Stride time & payroll core."
        actions={
          <Link
            href="/dashboard/healthcare/rota"
            className="inline-flex h-9 items-center rounded-md bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600"
          >
            Clinical rota
          </Link>
        }
      />
      <DashboardStatGrid>
        <DashboardStatCard label="Active wards" value={String(summary.activeWards)} />
        <DashboardStatCard label="Shifts (7 days)" value={String(summary.upcomingClinicalShifts)} />
        <DashboardStatCard label="Licence gaps" value={String(summary.licenseGaps)} />
        <DashboardStatCard label="NHIF on file" value={`${summary.nhifCompliancePct}%`} />
      </DashboardStatGrid>
    </DashboardPage>
  );
}
