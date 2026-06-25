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
    activePermits: number;
    expiringPermits: number;
    expiredPermits: number;
    openIncidents: number;
    entityCount: number;
  };
};

export default function EnergyOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/energy/overview')
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
        <DashboardAsyncState variant="error" title="Energy" message={error ?? 'Unknown error'} />
      </DashboardPage>
    );
  }

  const { summary } = data;

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Energy vertical"
        title="Permits & HSE"
        description="Site register, permit compliance calendar, and multi-entity HSE rollup for energy operators."
        actions={
          <Link
            href="/dashboard/energy/permits"
            className="inline-flex h-9 items-center rounded-md bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600"
          >
            View permits
          </Link>
        }
      />
      <DashboardStatGrid>
        <DashboardStatCard label="Active sites" value={String(summary.activeSites)} />
        <DashboardStatCard label="Active permits" value={String(summary.activePermits)} />
        <DashboardStatCard label="Expiring soon" value={String(summary.expiringPermits)} />
        <DashboardStatCard label="Open HSE incidents" value={String(summary.openIncidents)} />
      </DashboardStatGrid>
    </DashboardPage>
  );
}
