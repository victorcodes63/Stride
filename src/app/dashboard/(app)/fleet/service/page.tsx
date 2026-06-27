'use client';

import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
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

type ServicePlan = {
  id: string;
  title: string;
  vehicleRegistration: string;
  dueAt: string;
  dueOdometerKm: number | null;
  status: string;
};

export default function FleetServicePage() {
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/fleet/service-plans')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load service plans.');
        setPlans((await r.json()) as ServicePlan[]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  const due = plans.filter((p) => p.status === 'due' || p.status === 'overdue').length;

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Service planning"
        description="Scheduled maintenance, inspections, and tyre services — linked to odometer and calendar due dates."
      />
      <DashboardAsyncState status={loading ? 'loading' : error ? 'error' : 'success'} error={error}>
        <>
          <DashboardStatGrid columns={3}>
            <DashboardMetricCard label="Scheduled" value={plans.length} icon={Wrench} />
            <DashboardMetricCard label="Due / overdue" value={due} icon={Wrench} tone={due > 0 ? 'warning' : 'success'} />
          </DashboardStatGrid>
          <DashboardTableCard>
            <DashboardTableViewport>
              {plans.length === 0 ? (
                <DashboardTableEmpty
                  title="No service plans"
                  description="Schedule vehicle services via POST /api/fleet/service-plans or use the Registers page for maintenance logs."
                />
              ) : (
                <DashboardTable>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Vehicle</th>
                      <th>Due date</th>
                      <th>Odometer</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr key={p.id}>
                        <td className="col-primary font-medium">{p.title}</td>
                        <td>{p.vehicleRegistration}</td>
                        <td>{new Date(p.dueAt).toLocaleDateString()}</td>
                        <td>{p.dueOdometerKm ? `${p.dueOdometerKm.toLocaleString()} km` : '—'}</td>
                        <td className="capitalize">{p.status.replace('_', ' ')}</td>
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
