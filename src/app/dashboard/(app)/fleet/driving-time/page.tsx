'use client';

import { useEffect, useState } from 'react';
import { Clock4 } from 'lucide-react';
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

type DrivingLog = {
  id: string;
  driverName: string;
  vehicleRegistration: string | null;
  tripNumber: string | null;
  sessionStart: string;
  drivingMinutes: number;
  restMinutes: number;
  exceedsLimit: boolean;
};

export default function FleetDrivingTimePage() {
  const [logs, setLogs] = useState<DrivingLog[]>([]);
  const [violationCount, setViolationCount] = useState(0);
  const [maxMinutes, setMaxMinutes] = useState(540);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/fleet/driving-time')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load driving time logs.');
        const json = (await r.json()) as {
          logs: DrivingLog[];
          violationCount: number;
          maxDrivingMinutes: number;
        };
        setLogs(json.logs);
        setViolationCount(json.violationCount);
        setMaxMinutes(json.maxDrivingMinutes);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Driving time"
        description="Driver hours and rest compliance — flags sessions exceeding the 9-hour HGV guidance limit."
      />
      <DashboardAsyncState status={loading ? 'loading' : error ? 'error' : 'success'} error={error}>
        <>
          <DashboardStatGrid columns={3}>
            <DashboardMetricCard label="Sessions logged" value={logs.length} icon={Clock4} />
            <DashboardMetricCard
              label="Limit violations"
              value={violationCount}
              icon={Clock4}
              tone={violationCount > 0 ? 'warning' : 'success'}
            />
            <DashboardMetricCard
              label="Max driving"
              value={`${Math.floor(maxMinutes / 60)}h`}
              icon={Clock4}
            />
          </DashboardStatGrid>
          <DashboardTableCard>
            <DashboardTableViewport>
              {logs.length === 0 ? (
                <DashboardTableEmpty
                  title="No driving sessions"
                  description="Driving time is recorded from telematics or manual POST to /api/fleet/driving-time."
                />
              ) : (
                <DashboardTable>
                  <thead>
                    <tr>
                      <th>Driver</th>
                      <th>Vehicle</th>
                      <th>Trip</th>
                      <th>Driving</th>
                      <th>Rest</th>
                      <th>Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td className="col-primary font-medium">{l.driverName}</td>
                        <td>{l.vehicleRegistration ?? '—'}</td>
                        <td>{l.tripNumber ?? '—'}</td>
                        <td>{Math.floor(l.drivingMinutes / 60)}h {l.drivingMinutes % 60}m</td>
                        <td>{l.restMinutes}m</td>
                        <td>
                          {l.exceedsLimit ? (
                            <span className="text-xs font-medium text-amber-700">Over limit</span>
                          ) : (
                            <span className="text-xs font-medium text-emerald-700">OK</span>
                          )}
                        </td>
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
