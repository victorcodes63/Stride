'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

type Overview = {
  summary: {
    activeSites: number;
    plantOnSite: number;
    activeSubcontractors: number;
    subcontractorOutstanding: number;
  };
};

export default function ConstructionOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/construction/overview')
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
        <DashboardAsyncState variant="error" title="Construction" message={error ?? 'Unknown error'} />
      </DashboardPage>
    );
  }

  const { summary } = data;

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Construction vertical"
        title="Sites & plant"
        description="Site hierarchy, plant asset tracking, and subcontractor accounts payable on the Stride projects core."
        actions={
          <Link
            href="/dashboard/construction/sites"
            className="inline-flex h-9 items-center rounded-md bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600"
          >
            View sites
          </Link>
        }
      />
      <DashboardStatGrid>
        <DashboardStatCard label="Active sites" value={String(summary.activeSites)} />
        <DashboardStatCard label="Plant on site" value={String(summary.plantOnSite)} />
        <DashboardStatCard label="Active subcontractors" value={String(summary.activeSubcontractors)} />
        <DashboardStatCard
          label="Subcontractor AP outstanding"
          value={`KES ${summary.subcontractorOutstanding.toLocaleString()}`}
        />
      </DashboardStatGrid>
    </DashboardPage>
  );
}
