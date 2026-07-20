'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Truck } from 'lucide-react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { StrideSelect } from '@/components/ui/stride-select';

type VehicleRow = {
  id: string;
  registration: string;
  label: string | null;
  vehicleType: string | null;
  ownership: string;
  status: string;
  depotLocation: string | null;
  capacityKg: number | null;
  odometerKm: number | null;
};

const OWNERSHIP_OPTIONS = [
  { value: 'managed', label: 'Managed' },
  { value: 'outsourced', label: 'Outsourced' },
] as const;

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'out_of_service', label: 'Out of service' },
] as const;

export default function FleetVehiclesPage() {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/fleet/vehicles')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load vehicles.');
        setVehicles((await r.json()) as VehicleRow[]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unable to load vehicles.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const listStatus = loading ? 'loading' : error ? 'error' : 'success';

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Vehicle register"
        description="Managed fleet and outsourced capacity with live status."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Add vehicle
          </button>
        }
      />

      <DashboardAsyncState status={listStatus} error={error}>
        <DashboardTableCard>
          <DashboardTableViewport>
            {vehicles.length === 0 ? (
              <DashboardTableEmpty
                title="No vehicles registered"
                description="Add a managed or outsourced vehicle to start dispatch."
              >
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
                >
                  <Plus className="h-4 w-4" /> Add vehicle
                </button>
              </DashboardTableEmpty>
            ) : (
              <DashboardTable>
                <thead>
                  <tr>
                    <th>Registration</th>
                    <th>Type</th>
                    <th>Ownership</th>
                    <th>Status</th>
                    <th>Depot</th>
                    <th className="col-right">Odometer</th>
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
                      <td className="col-right">
                        {vehicle.odometerKm != null
                          ? `${vehicle.odometerKm.toLocaleString()} km`
                          : '—'}
                      </td>
                      <td className="col-right">
                        {vehicle.capacityKg != null
                          ? vehicle.capacityKg.toLocaleString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            )}
          </DashboardTableViewport>
        </DashboardTableCard>
      </DashboardAsyncState>

      {createOpen ? (
        <CreateVehicleModal
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

function CreateVehicleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [registration, setRegistration] = useState('');
  const [label, setLabel] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [ownership, setOwnership] = useState<'managed' | 'outsourced'>('managed');
  const [status, setStatus] = useState<'available' | 'in_transit' | 'maintenance' | 'out_of_service'>(
    'available',
  );
  const [depotLocation, setDepotLocation] = useState('');
  const [capacityKg, setCapacityKg] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch('/api/fleet/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration,
          label: label || undefined,
          vehicleType: vehicleType || undefined,
          ownership,
          status,
          depotLocation: depotLocation || undefined,
          capacityKg: capacityKg ? Number(capacityKg) : undefined,
          odometerKm: odometerKm ? Number(odometerKm) : undefined,
          notes: notes || undefined,
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
          <Truck className="h-5 w-5 text-[var(--stride-coral)]" />
          Add vehicle
        </h2>
        <label className="mt-4 block text-xs text-[var(--dash-text-muted)]">
          Registration
          <input
            required
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            placeholder="KCA 123A"
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Label
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Optional nickname"
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Vehicle type
          <input
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            placeholder="e.g. 28T prime mover"
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Ownership
            <StrideSelect
              value={ownership}
              onChange={(value) => setOwnership(value as 'managed' | 'outsourced')}
              options={OWNERSHIP_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              ariaLabel="Ownership"
              className="mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Status
            <StrideSelect
              value={status}
              onChange={(value) =>
                setStatus(
                  value as 'available' | 'in_transit' | 'maintenance' | 'out_of_service',
                )
              }
              options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
              ariaLabel="Status"
              className="mt-1 w-full"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Depot location
          <input
            value={depotLocation}
            onChange={(e) => setDepotLocation(e.target.value)}
            placeholder="e.g. Nairobi — Industrial Area"
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Capacity (kg)
            <input
              type="number"
              min={0}
              value={capacityKg}
              onChange={(e) => setCapacityKg(e.target.value)}
              className="dash-auth-input mt-1 w-full"
            />
          </label>
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Odometer (km)
            <input
              type="number"
              min={0}
              value={odometerKm}
              onChange={(e) => setOdometerKm(e.target.value)}
              className="dash-auth-input mt-1 w-full"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
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
            disabled={saving || !registration.trim()}
            className="rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
