'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
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

type Geofence = {
  id: string;
  name: string;
  geofenceType: string;
  description: string | null;
  isActive: boolean;
  alertOnEntry: boolean;
  alertOnExit: boolean;
};

const GEOFENCE_TYPES = [
  { value: 'depot', label: 'Depot' },
  { value: 'customer_site', label: 'Customer site' },
  { value: 'corridor', label: 'Corridor' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'custom', label: 'Custom' },
] as const;

export default function FleetGeofencesPage() {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/fleet/geofences')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load geofences.');
        setGeofences((await r.json()) as Geofence[]);
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
        title="Geofences"
        description="Depot yards, customer sites, and zones with entry/exit alerts."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Add geofence
          </button>
        }
      />
      <DashboardAsyncState status={loading ? 'loading' : error ? 'error' : 'success'} error={error}>
        <DashboardTableCard>
          <DashboardTableViewport>
            {geofences.length === 0 ? (
              <DashboardTableEmpty
                title="No geofences configured"
                description="Define depot boundaries and delivery zones with a centre point and radius."
              >
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
                >
                  <Plus className="h-4 w-4" /> Create geofence
                </button>
              </DashboardTableEmpty>
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

      {createOpen ? (
        <CreateGeofenceModal
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

function CreateGeofenceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [geofenceType, setGeofenceType] = useState<string>('depot');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('-1.2921');
  const [longitude, setLongitude] = useState('36.8219');
  const [radiusMeters, setRadiusMeters] = useState('500');
  const [alertOnEntry, setAlertOnEntry] = useState(true);
  const [alertOnExit, setAlertOnExit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const lat = Number(latitude);
    const lng = Number(longitude);
    const radius = Number(radiusMeters);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setErr('Latitude and longitude must be numbers.');
      setSaving(false);
      return;
    }
    try {
      const r = await fetch('/api/fleet/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          geofenceType,
          description: description || undefined,
          geometry: {
            type: 'Point',
            coordinates: [lng, lat],
            radiusMeters: Number.isNaN(radius) ? 500 : radius,
          },
          alertOnEntry,
          alertOnExit,
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
          <MapPin className="h-5 w-5 text-[var(--stride-coral)]" />
          New geofence
        </h2>
        <label className="mt-4 block text-xs text-[var(--dash-text-muted)]">
          Name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nairobi depot yard"
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Type
          <StrideSelect
            value={geofenceType}
            onChange={(value) => setGeofenceType(value)}
            options={GEOFENCE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            ariaLabel="Type"
            className="mt-1 w-full"
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
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Radius (metres)
          <input
            type="number"
            min={1}
            value={radiusMeters}
            onChange={(e) => setRadiusMeters(e.target.value)}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-xs text-[var(--dash-text-strong)]">
          <input
            type="checkbox"
            checked={alertOnEntry}
            onChange={(e) => setAlertOnEntry(e.target.checked)}
            className="rounded border-[var(--dash-border)]"
          />
          Alert on entry
        </label>
        <label className="mt-2 flex items-center gap-2 text-xs text-[var(--dash-text-strong)]">
          <input
            type="checkbox"
            checked={alertOnExit}
            onChange={(e) => setAlertOnExit(e.target.checked)}
            className="rounded border-[var(--dash-border)]"
          />
          Alert on exit
        </label>
        {err ? <p className="mt-3 text-xs text-red-600">{err}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
