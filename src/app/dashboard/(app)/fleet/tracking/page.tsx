'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Radio, Truck } from 'lucide-react';
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
import { StrideSelect } from '@/components/ui/stride-select';

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

type VehicleOption = { id: string; registration: string; label: string | null };

export default function FleetTrackingPage() {
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [inTransit, setInTransit] = useState<InTransitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback((signal?: { cancelled: boolean }) => {
    return Promise.all([
      fetch('/api/fleet/tracking/positions'),
      fetch('/api/fleet/in-transit'),
    ])
      .then(async ([posRes, transitRes]) => {
        if (signal?.cancelled) return;
        if (!posRes.ok) throw new Error('Unable to load tracking data.');
        setRows((await posRes.json()) as TrackingRow[]);
        if (transitRes.ok) {
          setInTransit((await transitRes.json()) as InTransitRow[]);
        }
        setError(null);
      })
      .catch((e) => {
        if (signal?.cancelled) return;
        setError(e instanceof Error ? e.message : 'Error');
      })
      .finally(() => {
        if (!signal?.cancelled) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    void load(signal);
    const interval = setInterval(() => void load(signal), 30_000);
    return () => {
      signal.cancelled = true;
      clearInterval(interval);
    };
  }, [load]);

  const withPosition = rows.filter((r) => r.position);
  const inTransitCount = rows.filter((r) => r.status === 'in_transit');

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Live tracking"
        description="Realtime vehicle positioning — refreshes every 30 seconds."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Log position
          </button>
        }
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
                  description="Add vehicles, then log a manual position ping or connect telematics."
                >
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
                  >
                    <Plus className="h-4 w-4" /> Log position
                  </button>
                </DashboardTableEmpty>
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

      {createOpen ? (
        <LogPositionModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void load();
          }}
        />
      ) : null}
    </DashboardPage>
  );
}

function LogPositionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [latitude, setLatitude] = useState('-1.2921');
  const [longitude, setLongitude] = useState('36.8219');
  const [speedKph, setSpeedKph] = useState('');
  const [headingDeg, setHeadingDeg] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/fleet/vehicles')
      .then(async (r) => (r.ok ? ((await r.json()) as VehicleOption[]) : []))
      .then((v) => {
        setVehicles(v);
        if (v[0]) setVehicleId(v[0].id);
      })
      .catch(() => setVehicles([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setErr('Latitude and longitude must be numbers.');
      setSaving(false);
      return;
    }
    try {
      const r = await fetch('/api/fleet/tracking/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          latitude: lat,
          longitude: lng,
          speedKph: speedKph ? Number(speedKph) : undefined,
          headingDeg: headingDeg ? Number(headingDeg) : undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Create failed');
      onCreated();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-5 shadow-xl"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--dash-text-strong)]">
          <Radio className="h-5 w-5 text-[var(--stride-coral)]" />
          Log position
        </h2>
        <label className="mt-4 block text-xs text-[var(--dash-text-muted)]">
          Vehicle
          <StrideSelect
            value={vehicleId}
            onChange={(value) => setVehicleId(value)}
            options={
              vehicles.length === 0
                ? [{ value: '', label: 'No vehicles found' }]
                : vehicles.map((v) => ({
                    value: v.id,
                    label: `${v.registration}${v.label ? ` — ${v.label}` : ''}`,
                  }))
            }
            ariaLabel="Vehicle"
            className="mt-1 w-full"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Latitude
            <input
              required
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="dash-auth-input mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Longitude
            <input
              required
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="dash-auth-input mt-1 w-full"
            />
          </label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Speed (km/h)
            <input
              type="number"
              min={0}
              value={speedKph}
              onChange={(e) => setSpeedKph(e.target.value)}
              placeholder="Optional"
              className="dash-auth-input mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Heading (°)
            <input
              type="number"
              min={0}
              max={359}
              value={headingDeg}
              onChange={(e) => setHeadingDeg(e.target.value)}
              placeholder="Optional"
              className="dash-auth-input mt-1 w-full"
            />
          </label>
        </div>
        {err ? <p className="mt-3 text-xs text-red-600">{err}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !vehicleId}
            className="rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Log'}
          </button>
        </div>
      </form>
    </div>
  );
}
