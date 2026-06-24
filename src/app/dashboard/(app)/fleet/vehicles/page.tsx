'use client';

import { useEffect, useState } from 'react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';

type VehicleRow = {
  id: string;
  registration: string;
  label: string | null;
  vehicleType: string | null;
  ownership: string;
  status: string;
  depotLocation: string | null;
  capacityKg: number | null;
};

export default function FleetVehiclesPage() {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/fleet/vehicles');
        if (!res.ok) throw new Error('Unable to load vehicles.');
        const json = (await res.json()) as VehicleRow[];
        if (!cancelled) setVehicles(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load vehicles.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const listStatus = loading ? 'loading' : error ? 'error' : 'success';

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Vehicle register"
        description="Managed fleet and outsourced capacity with live status."
      />

      <DashboardAsyncState status={listStatus} error={error}>
        <DashboardTableCard>
          <DashboardTableViewport>
            {vehicles.length === 0 ? (
              <DashboardTableEmpty
                title="No vehicles registered"
                description="Seed fleet demo data or add vehicles from dispatch."
              />
            ) : (
              <DashboardTable>
                <thead>
                  <tr>
                    <th>Registration</th>
                    <th>Type</th>
                    <th>Ownership</th>
                    <th>Status</th>
                    <th>Depot</th>
                    <th className="col-right">Capacity (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td className="col-primary font-medium">
                        {vehicle.registration}
                        {vehicle.label ? (
                          <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                            {vehicle.label}
                          </span>
                        ) : null}
                      </td>
                      <td>{vehicle.vehicleType ?? '—'}</td>
                      <td className="capitalize">{vehicle.ownership}</td>
                      <td className="capitalize">{vehicle.status.replace(/_/g, ' ')}</td>
                      <td>{vehicle.depotLocation ?? '—'}</td>
                      <td className="col-right">{vehicle.capacityKg ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            )}
          </DashboardTableViewport>
        </DashboardTableCard>
      </DashboardAsyncState>
    </DashboardPage>
  );
}
