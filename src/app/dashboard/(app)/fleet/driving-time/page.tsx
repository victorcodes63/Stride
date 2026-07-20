'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock4, Plus } from 'lucide-react';
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
import { StrideSelect } from '@/components/ui/stride-select';

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

type DriverOption = { id: string; fullName: string };
type VehicleOption = { id: string; registration: string; label: string | null };

export default function FleetDrivingTimePage() {
  const [logs, setLogs] = useState<DrivingLog[]>([]);
  const [violationCount, setViolationCount] = useState(0);
  const [maxMinutes, setMaxMinutes] = useState(540);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
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

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Driving time"
        description="Driver hours and rest compliance — flags sessions exceeding the 9-hour HGV guidance limit."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Log session
          </button>
        }
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
                  description="Record driving time manually or from telematics."
                >
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
                  >
                    <Plus className="h-4 w-4" /> Log session
                  </button>
                </DashboardTableEmpty>
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

      {createOpen ? (
        <CreateDrivingTimeModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      ) : null}
    </DashboardPage>
  );
}

function CreateDrivingTimeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [sessionStart, setSessionStart] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [sessionEnd, setSessionEnd] = useState('');
  const [drivingMinutes, setDrivingMinutes] = useState('');
  const [restMinutes, setRestMinutes] = useState('0');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/fleet/drivers').then(async (r) => (r.ok ? ((await r.json()) as DriverOption[]) : [])),
      fetch('/api/fleet/vehicles').then(async (r) => (r.ok ? ((await r.json()) as VehicleOption[]) : [])),
    ])
      .then(([d, v]) => {
        setDrivers(d);
        setVehicles(v);
        if (d[0]) setDriverId(d[0].id);
      })
      .catch(() => {
        setDrivers([]);
        setVehicles([]);
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch('/api/fleet/driving-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          vehicleId: vehicleId || undefined,
          sessionStart: new Date(sessionStart).toISOString(),
          sessionEnd: sessionEnd ? new Date(sessionEnd).toISOString() : undefined,
          drivingMinutes: drivingMinutes ? Number(drivingMinutes) : 0,
          restMinutes: restMinutes ? Number(restMinutes) : 0,
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
          <Clock4 className="h-5 w-5 text-[var(--stride-coral)]" />
          Log driving session
        </h2>
        <label className="mt-4 block text-xs text-[var(--dash-text-muted)]">
          Driver
          <StrideSelect
            value={driverId}
            onChange={(value) => setDriverId(value)}
            options={
              drivers.length === 0
                ? [{ value: '', label: 'No drivers found' }]
                : drivers.map((d) => ({ value: d.id, label: d.fullName }))
            }
            ariaLabel="Driver"
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Vehicle
          <StrideSelect
            value={vehicleId}
            onChange={(value) => setVehicleId(value)}
            options={[
              { value: '', label: '— Optional —' },
              ...vehicles.map((v) => ({
                value: v.id,
                label: `${v.registration}${v.label ? ` — ${v.label}` : ''}`,
              })),
            ]}
            ariaLabel="Vehicle"
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Session start
          <input
            required
            type="datetime-local"
            value={sessionStart}
            onChange={(e) => setSessionStart(e.target.value)}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Session end
          <input
            type="datetime-local"
            value={sessionEnd}
            onChange={(e) => setSessionEnd(e.target.value)}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Driving (minutes)
            <input
              type="number"
              min={0}
              value={drivingMinutes}
              onChange={(e) => setDrivingMinutes(e.target.value)}
              required
              className="dash-auth-input mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Rest (minutes)
            <input
              type="number"
              min={0}
              value={restMinutes}
              onChange={(e) => setRestMinutes(e.target.value)}
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
            disabled={saving || !driverId}
            className="rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
