'use client';

import { useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTable, DashboardTableCard, DashboardTableEmpty, DashboardTableViewport } from '@/components/dashboard/DashboardDataTable';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

type RollupRow = {
  entityLabel: string;
  clientName: string;
  siteCount: number;
  openIncidents: number;
  highSeverity: number;
  permitsExpiring: number;
};

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
      <DashboardTableCard title="Entity rollup">
        <DashboardTableViewport>
          <DashboardTable>
            <thead>
              <tr>
                <th>Entity</th>
                <th>Client</th>
                <th>Sites</th>
                <th>Open incidents</th>
                <th>High severity</th>
                <th>Permits expiring</th>
              </tr>
            </thead>
            <tbody>
              {rollup.map((row) => (
                <tr key={row.entityLabel + row.clientName}>
                  <td>{row.entityLabel}</td>
                  <td>{row.clientName}</td>
                  <td>{row.siteCount}</td>
                  <td>{row.openIncidents}</td>
                  <td>{row.highSeverity}</td>
                  <td>{row.permitsExpiring}</td>
                </tr>
              ))}
            </tbody>
          </DashboardTable>
          {rollup.length === 0 ? <DashboardTableEmpty message="No energy sites seeded for rollup." /> : null}
        </DashboardTableViewport>
      </DashboardTableCard>
    </DashboardPage>
  );
}
