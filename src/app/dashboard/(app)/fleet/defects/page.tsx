'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
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

type Defect = {
  id: string;
  title: string;
  severity: string;
  status: string;
  vehicleRegistration: string;
  driverName: string | null;
  reportedAt: string;
};

type VehicleOption = { id: string; registration: string; label: string | null };
type DriverOption = { id: string; fullName: string };

const SEVERITIES = [
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
  { value: 'critical', label: 'Critical' },
] as const;

export default function FleetDefectsPage() {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/fleet/defects')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load defects.');
        setDefects((await r.json()) as Defect[]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = defects.filter((d) => d.status !== 'closed' && d.status !== 'resolved').length;

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Defect reports"
        description="Vehicle defects reported by drivers or workshop — from minor faults to critical safety issues."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Report defect
          </button>
        }
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
                <DashboardTableEmpty title="No defect reports" description="Report vehicle faults from the workshop or driver.">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
                  >
                    <Plus className="h-4 w-4" /> Report defect
                  </button>
                </DashboardTableEmpty>
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

      {createOpen ? (
        <CreateDefectModal
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

function CreateDefectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [reportedByDriverId, setReportedByDriverId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('minor');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/fleet/vehicles').then(async (r) => (r.ok ? ((await r.json()) as VehicleOption[]) : [])),
      fetch('/api/fleet/drivers').then(async (r) => (r.ok ? ((await r.json()) as DriverOption[]) : [])),
    ])
      .then(([v, d]) => {
        setVehicles(v);
        setDrivers(d);
        if (v[0]) setVehicleId(v[0].id);
      })
      .catch(() => {
        setVehicles([]);
        setDrivers([]);
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch('/api/fleet/defects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          title,
          description,
          severity,
          reportedByDriverId: reportedByDriverId || undefined,
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
          <AlertTriangle className="h-5 w-5 text-[var(--stride-coral)]" />
          Report defect
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
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Reported by (driver)
          <StrideSelect
            value={reportedByDriverId}
            onChange={(value) => setReportedByDriverId(value)}
            options={[
              { value: '', label: '— Optional —' },
              ...drivers.map((d) => ({ value: d.id, label: d.fullName })),
            ]}
            ariaLabel="Reported by (driver)"
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brake warning light"
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Description
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Severity
          <StrideSelect
            value={severity}
            onChange={(value) => setSeverity(value)}
            options={SEVERITIES.map((s) => ({ value: s.value, label: s.label }))}
            ariaLabel="Severity"
            className="mt-1 w-full"
          />
        </label>
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
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
