'use client';

import { useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { EnergyHseRollupTable, type EnergyHseRollupRow } from '@/components/energy/EnergyHseRollupTable';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

type RollupRow = EnergyHseRollupRow;

export default function EnergyHseRollupPage() {
  const [rollup, setRollup] = useState<RollupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/energy/hse/rollup')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed');
        setRollup(json.rollup ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardPageSkeleton />;
  if (error) {
    return (
      <DashboardPage>
        <DashboardAsyncState variant="error" title="HSE rollup" message={error} />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Energy"
        title="Multi-entity HSE rollup"
        description="Group-level view of open incidents and permit exposure across operating entities."
      />
      <EnergyHseRollupTable rows={rollup} />
    </DashboardPage>
  );
}
