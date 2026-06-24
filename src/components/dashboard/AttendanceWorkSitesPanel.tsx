'use client';

import { useEffect, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';

type WorkSite = {
  id: string;
  name: string;
  code: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
};

type GeofencePolicy = {
  id: string;
  mobileGeofenceEnabled: boolean;
  rejectOutsideGeofence: boolean;
};

type Props = {
  clientId: string;
};

export function AttendanceWorkSitesPanel({ clientId }: Props) {
  const [sites, setSites] = useState<WorkSite[]>([]);
  const [policy, setPolicy] = useState<GeofencePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('150');
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/outsourcing/attendance/work-sites?clientId=${encodeURIComponent(clientId)}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load work sites');
      setSites(data.sites ?? []);
      setPolicy(data.policy ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load work sites');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [clientId]);

  async function addSite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/outsourcing/attendance/work-sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          name,
          latitude: Number(latitude),
          longitude: Number(longitude),
          radiusMeters: Number(radiusMeters) || 150,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add work site');
      setName('');
      setLatitude('');
      setLongitude('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add work site');
    } finally {
      setSaving(false);
    }
  }

  async function togglePolicy(field: 'mobileGeofenceEnabled' | 'rejectOutsideGeofence', value: boolean) {
    const res = await fetch('/api/outsourcing/attendance/work-sites', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, [field]: value }),
    });
    if (res.ok) await load();
  }

  return (
    <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-[var(--dash-muted)]" />
        <h2 className="text-sm font-bold text-[var(--dash-ink)]">Mobile geofence work sites</h2>
      </div>
      <p className="mb-4 text-xs text-[var(--dash-muted)]">
        ESS clock-in uses GPS when geofencing is enabled. Employees outside the radius are blocked or flagged for
        manager review.
      </p>
      {policy ? (
        <div className="mb-4 flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={policy.mobileGeofenceEnabled}
              onChange={(e) => void togglePolicy('mobileGeofenceEnabled', e.target.checked)}
            />
            Require geofence for ESS mobile clock
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={policy.rejectOutsideGeofence}
              onChange={(e) => void togglePolicy('rejectOutsideGeofence', e.target.checked)}
            />
            Reject clock-in outside fence
          </label>
        </div>
      ) : null}
      {error ? <p className="mb-3 text-xs text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-xs text-[var(--dash-muted)]">Loading work sites…</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {sites.length === 0 ? (
            <li className="text-xs text-[var(--dash-muted)]">No work sites configured yet.</li>
          ) : (
            sites.map((site) => (
              <li
                key={site.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-xs"
              >
                <span className="font-semibold text-[var(--dash-ink)]">
                  {site.name}
                  {!site.isActive ? ' (inactive)' : ''}
                </span>
                <span className="text-[var(--dash-muted)]">
                  {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)} · {site.radiusMeters} m
                </span>
              </li>
            ))
          )}
        </ul>
      )}
      <form onSubmit={addSite} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className="rounded-lg border border-[var(--dash-border)] px-3 py-2 text-xs"
          placeholder="Site name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="rounded-lg border border-[var(--dash-border)] px-3 py-2 text-xs"
          placeholder="Latitude"
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          required
        />
        <input
          className="rounded-lg border border-[var(--dash-border)] px-3 py-2 text-xs"
          placeholder="Longitude"
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
          required
        />
        <input
          className="rounded-lg border border-[var(--dash-border)] px-3 py-2 text-xs"
          placeholder="Radius (m)"
          value={radiusMeters}
          onChange={(e) => setRadiusMeters(e.target.value)}
        />
        <button
          type="submit"
          disabled={saving || !clientId}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" />
          Add site
        </button>
      </form>
    </section>
  );
}
