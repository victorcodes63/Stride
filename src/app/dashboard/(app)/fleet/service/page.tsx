'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Wrench } from 'lucide-react';
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

type ServicePlan = {
  id: string;
  title: string;
  vehicleRegistration: string;
  dueAt: string;
  dueOdometerKm: number | null;
  status: string;
};

type VehicleOption = { id: string; registration: string; label: string | null };

export default function FleetServicePage() {
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/fleet/service-plans')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load service plans.');
        setPlans((await r.json()) as ServicePlan[]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const due = plans.filter((p) => p.status === 'due' || p.status === 'overdue').length;

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Service planning"
        description="Scheduled maintenance, inspections, and tyre services — linked to odometer and calendar due dates."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Schedule service
          </button>
        }
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
                  description="Schedule vehicle services or use Registers for maintenance logs."
                >
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
                  >
                    <Plus className="h-4 w-4" /> Schedule service
                  </button>
                </DashboardTableEmpty>
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

      {createOpen ? (
        <CreateServicePlanModal
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

function CreateServicePlanModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [dueOdometerKm, setDueOdometerKm] = useState('');
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
    try {
      const r = await fetch('/api/fleet/service-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          title,
          description: description || undefined,
          dueAt,
          dueOdometerKm: dueOdometerKm ? Number(dueOdometerKm) : undefined,
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
          <Wrench className="h-5 w-5 text-[var(--stride-coral)]" />
          Schedule service
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
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Oil change / inspection"
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Due date
          <input
            required
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Due odometer (km)
          <input
            type="number"
            min={0}
            value={dueOdometerKm}
            onChange={(e) => setDueOdometerKm(e.target.value)}
            placeholder="Optional"
            className="dash-auth-input mt-1 w-full"
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
