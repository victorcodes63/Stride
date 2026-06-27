'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';

type Geofence = {
  id: string;
  name: string;
  geofenceType: string;
  description: string | null;
  isActive: boolean;
  alertOnEntry: boolean;
  alertOnExit: boolean;
};

export default function FleetGeofencesPage() {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/fleet/geofences')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load geofences.');
        setGeofences((await r.json()) as Geofence[]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Geofences"
        description="Depot yards, customer sites, corridor zones, and restricted areas — with entry/exit alerts."
      />
      <DashboardAsyncState status={loading ? 'loading' : error ? 'error' : 'success'} error={error}>
        <DashboardTableCard>
          <DashboardTableViewport>
            {geofences.length === 0 ? (
              <DashboardTableEmpty
                title="No geofences configured"
                description="Define depot boundaries and delivery zones via POST /api/fleet/geofences with GeoJSON geometry."
              />
            ) : (
              <DashboardTable>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Alerts</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {geofences.map((g) => (
                    <tr key={g.id}>
                      <td className="col-primary font-medium">{g.name}</td>
                      <td className="capitalize">{g.geofenceType.replace('_', ' ')}</td>
                      <td className="text-sm text-neutral-600">
                        {g.alertOnEntry ? 'Entry' : ''}
                        {g.alertOnEntry && g.alertOnExit ? ' · ' : ''}
                        {g.alertOnExit ? 'Exit' : ''}
                      </td>
                      <td>{g.isActive ? 'Active' : 'Inactive'}</td>
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
