'use client';

import { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardMetricCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';

type EnvSummary = {
  fuelLiters: number;
  fuelSpendKes: number;
  fillCount: number;
  co2KgEstimate: number;
};

export default function FleetEnvironmentalPage() {
  const [summary, setSummary] = useState<EnvSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/fleet/environmental')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load environmental data.');
        const json = (await r.json()) as { summary30d: EnvSummary };
        setSummary(json.summary30d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Environmental reports"
        description="Fuel consumption and CO₂ estimates for fleet sustainability reporting — last 30 days."
      />
      <DashboardAsyncState status={loading ? 'loading' : error ? 'error' : 'success'} error={error}>
        <>
          <DashboardStatGrid>
            <DashboardMetricCard
              label="Fuel consumed (30d)"
              value={summary ? `${summary.fuelLiters.toLocaleString()} L` : '—'}
              icon={Leaf}
            />
            <DashboardMetricCard
              label="Fuel spend (30d)"
              value={summary ? `KES ${summary.fuelSpendKes.toLocaleString()}` : '—'}
              icon={Leaf}
            />
            <DashboardMetricCard
              label="CO₂ estimate (30d)"
              value={summary ? `${summary.co2KgEstimate.toLocaleString()} kg` : '—'}
              icon={Leaf}
              tone="warning"
            />
            <DashboardMetricCard label="Fill-ups" value={summary?.fillCount ?? 0} icon={Leaf} />
          </DashboardStatGrid>
          <DashboardTableCard>
            <DashboardTableEmpty
              title="Period snapshots"
              description="Detailed per-trip environmental snapshots are recorded as trips complete. Fuel data comes from the fuel register."
            />
          </DashboardTableCard>
        </>
      </DashboardAsyncState>
    </DashboardPage>
  );
}
