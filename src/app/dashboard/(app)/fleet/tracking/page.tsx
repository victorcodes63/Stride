'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Radio, Truck } from 'lucide-react';
import {
  DashboardAsyncState,
  DashboardPageSkeleton,
} from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardMetricCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';

type TrackingRow = {
  vehicleId: string;
  registration: string;
  label: string | null;
  status: string;
  depotLocation: string | null;
  activeTrip: {
    id: string;
    tripNumber: string;
    origin: string;
    destination: string;
    driver: { fullName: string } | null;
  } | null;
  position: {
    latitude: number;
    longitude: number;
    speedKph: number | null;
    recordedAt: string;
  } | null;
};

type InTransitRow = {
  id: string;
  tripNumber: string;
  origin: string;
  destination: string;
  customerName: string;
  driverName: string | null;
  vehicleRegistration: string | null;
  etaAt: string | null;
  plannedDeliveryAt: string | null;
  podVerified: boolean;
};

export default function FleetTrackingPage() {
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [inTransit, setInTransit] = useState<InTransitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      Promise.all([
        fetch('/api/fleet/tracking/positions'),
        fetch('/api/fleet/in-transit'),
      ])
        .then(async ([posRes, transitRes]) => {
          if (!posRes.ok) throw new Error('Unable to load tracking data.');
          if (!cancelled) setRows((await posRes.json()) as TrackingRow[]);
          if (transitRes.ok && !cancelled) {
            setInTransit((await transitRes.json()) as InTransitRow[]);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Error');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

    void load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const withPosition = rows.filter((r) => r.position);
  const inTransitCount = rows.filter((r) => r.status === 'in_transit');

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Live tracking"
        description="Realtime vehicle positioning — refreshes every 30 seconds. Connect telematics devices via the positions API."
      />

      <DashboardAsyncState
        status={loading ? 'loading' : error ? 'error' : 'success'}
        error={error}
        loading={<DashboardPageSkeleton variant="stats" />}
      >
        <>
          <DashboardStatGrid>
            <DashboardMetricCard label="Tracked vehicles" value={rows.length} icon={Truck} />
            <DashboardMetricCard label="With GPS fix" value={withPosition.length} icon={Radio} tone="success" />
            <DashboardMetricCard label="In transit" value={inTransitCount.length} icon={Radio} tone="primary" />
          </DashboardStatGrid>

          <DashboardTableCard>
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-ink">Fleet positions</h2>
            </div>
            <DashboardTableViewport>
              {rows.length === 0 ? (
                <DashboardTableEmpty
                  title="No vehicles to track"
                  description="Add vehicles and post position updates via POST /api/fleet/tracking/positions."
                />
              ) : (
                <DashboardTable>
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Status</th>
                      <th>Active trip</th>
                      <th>Position</th>
                      <th>Speed</th>
                      <th>Last update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.vehicleId}>
                        <td className="col-primary font-medium">
                          {row.registration}
                          {row.label ? (
                            <span className="ml-1 text-xs font-normal text-neutral-500">{row.label}</span>
                          ) : null}
                        </td>
                        <td className="capitalize">{row.status.replace('_', ' ')}</td>
                        <td>
                          {row.activeTrip ? (
                            <Link
                              href={`/dashboard/fleet/trips/${row.activeTrip.id}`}
                              className="text-sm text-primary-600 hover:underline"
                            >
                              {row.activeTrip.tripNumber}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="col-muted text-sm">
                          {row.position ? (
                            <a
                              href={`https://maps.google.com/?q=${row.position.latitude},${row.position.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:underline"
                            >
                              {row.position.latitude.toFixed(4)}, {row.position.longitude.toFixed(4)}
                            </a>
                          ) : (
                            row.depotLocation ?? 'No fix'
                          )}
                        </td>
                        <td>{row.position?.speedKph != null ? `${row.position.speedKph} km/h` : '—'}</td>
                        <td className="col-muted text-sm">
                          {row.position
                            ? new Date(row.position.recordedAt).toLocaleString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
              )}
            </DashboardTableViewport>
          </DashboardTableCard>

          <DashboardTableCard className="mt-6">
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-ink">In-transit board</h2>
              <p className="mt-1 text-xs text-neutral-500">ETA from planned delivery or distance/speed estimate.</p>
            </div>
            <DashboardTableViewport>
              {inTransit.length === 0 ? (
                <DashboardTableEmpty title="No trips in transit" description="Dispatched trips appear here with ETA." />
              ) : (
                <DashboardTable>
                  <thead>
                    <tr>
                      <th>Trip</th>
                      <th>Customer</th>
                      <th>Driver</th>
                      <th>ETA</th>
                      <th>POD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inTransit.map((trip) => (
                      <tr key={trip.id}>
                        <td className="col-primary">
                          <Link href={`/dashboard/fleet/trips/${trip.id}`} className="font-medium text-primary-600 hover:underline">
                            {trip.tripNumber}
                          </Link>
                          <span className="mt-0.5 block text-xs text-neutral-500">
                            {trip.origin} → {trip.destination}
                          </span>
                        </td>
                        <td>{trip.customerName}</td>
                        <td>{trip.driverName ?? trip.vehicleRegistration ?? '—'}</td>
                        <td>
                          {trip.etaAt
                            ? new Date(trip.etaAt).toLocaleString()
                            : trip.plannedDeliveryAt
                              ? new Date(trip.plannedDeliveryAt).toLocaleString()
                              : '—'}
                        </td>
                        <td>{trip.podVerified ? 'Verified' : 'Pending'}</td>
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
