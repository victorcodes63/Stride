'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
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

type Defect = {
  id: string;
  title: string;
  severity: string;
  status: string;
  vehicleRegistration: string;
  driverName: string | null;
  reportedAt: string;
};

export default function FleetDefectsPage() {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/fleet/defects')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load defects.');
        setDefects((await r.json()) as Defect[]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  const open = defects.filter((d) => d.status !== 'closed' && d.status !== 'resolved').length;

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Defect reports"
        description="Vehicle defects reported by drivers or workshop — from minor faults to critical safety issues."
      />
      <DashboardAsyncState status={loading ? 'loading' : error ? 'error' : 'success'} error={error}>
        <>
          <DashboardStatGrid columns={3}>
            <DashboardMetricCard label="Total reports" value={defects.length} icon={AlertTriangle} />
            <DashboardMetricCard
              label="Open defects"
              value={open}
              icon={AlertTriangle}
              tone={open > 0 ? 'warning' : 'success'}
            />
          </DashboardStatGrid>
          <DashboardTableCard>
            <DashboardTableViewport>
              {defects.length === 0 ? (
                <DashboardTableEmpty title="No defect reports" description="Drivers can report defects via POST /api/fleet/defects." />
              ) : (
                <DashboardTable>
                  <thead>
                    <tr>
                      <th>Defect</th>
                      <th>Vehicle</th>
                      <th>Reporter</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Reported</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defects.map((d) => (
                      <tr key={d.id}>
                        <td className="col-primary font-medium">{d.title}</td>
                        <td>{d.vehicleRegistration}</td>
                        <td>{d.driverName ?? '—'}</td>
                        <td className="capitalize">{d.severity}</td>
                        <td className="capitalize">{d.status.replace('_', ' ')}</td>
                        <td className="col-muted text-sm">{new Date(d.reportedAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
              )}
            </DashboardTableViewport>
          </DashboardTableCard>
        </>
      </DashboardAsyncState>
    </DashboardPage>
  );
}
