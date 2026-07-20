'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Plus, Power } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { DashboardInlineLoading } from '@/components/dashboard/DashboardAsyncState';
import type { GeofencePolicy, WorkSite } from './types';

export function StaffAttendanceWorkSitesPanel() {
  const [sites, setSites] = useState<WorkSite[]>([]);
  const [policy, setPolicy] = useState<GeofencePolicy | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('150');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff/attendance/work-sites', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load work sites');
      setSites(data.sites ?? []);
      setPolicy(data.policy ?? null);
      setCanManage(Boolean(data.canManage));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load work sites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addSite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/staff/attendance/work-sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code: code || undefined,
          latitude: Number(latitude),
          longitude: Number(longitude),
          radiusMeters: Number(radiusMeters) || 150,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add work site');
      setName('');
      setCode('');
      setLatitude('');
      setLongitude('');
      setRadiusMeters('150');
      toast.success('Work site added');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add work site');
    } finally {
      setSaving(false);
    }
  }

  async function patch(payload: Record<string, unknown>, successMessage?: string) {
    const res = await fetch('/api/staff/attendance/work-sites', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      if (successMessage) toast.success(successMessage);
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || 'Update failed');
    }
  }

  return (
    <section className="dashboard-surface p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-[var(--dash-text-muted)]" aria-hidden />
        <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Mobile geofence work sites</h2>
      </div>
      <p className="mb-4 text-xs text-[var(--dash-text-muted)]">
        Staff mobile clock-in uses GPS when geofencing is enabled. Staff outside the radius are blocked or flagged for
        manager review.
      </p>

      {policy ? (
        <div className="mb-4 flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={policy.mobileGeofenceEnabled}
              disabled={!canManage}
              onChange={(e) => void patch({ mobileGeofenceEnabled: e.target.checked }, 'Geofence setting updated')}
            />
            Require geofence for mobile clock-in
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={policy.rejectOutsideGeofence}
              disabled={!canManage}
              onChange={(e) => void patch({ rejectOutsideGeofence: e.target.checked }, 'Geofence setting updated')}
            />
            Reject clock-in outside fence
          </label>
        </div>
      ) : (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          No default attendance policy yet — create one under the Policies tab to control geofence enforcement.
        </p>
      )}

      {loading ? (
        <DashboardInlineLoading label="Loading work sites…" />
      ) : (
        <ul className="mb-4 space-y-2">
          {sites.length === 0 ? (
            <li className="text-xs text-[var(--dash-text-muted)]">No work sites configured yet.</li>
          ) : (
            sites.map((site) => (
              <li
                key={site.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-xs"
              >
                <span className="font-semibold text-[var(--dash-text-strong)]">
                  {site.name}
                  {site.code ? <span className="ml-1 text-[var(--dash-text-muted)]">({site.code})</span> : null}
                  {!site.isActive ? <span className="ml-1 text-red-500">· inactive</span> : null}
                </span>
                <span className="flex items-center gap-3 text-[var(--dash-text-muted)]">
                  {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)} · {site.radiusMeters} m
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => void patch({ id: site.id, isActive: !site.isActive }, 'Work site updated')}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--dash-border)] px-2 py-1 hover:bg-[var(--dash-hover)]"
                      title={site.isActive ? 'Deactivate' : 'Activate'}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {site.isActive ? 'Disable' : 'Enable'}
                    </button>
                  ) : null}
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      {canManage ? (
        <form onSubmit={addSite} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <input
            className="dash-filter-select h-9 rounded-lg border px-3 text-xs lg:col-span-2"
            placeholder="Site name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="dash-filter-select h-9 rounded-lg border px-3 text-xs"
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <input
            className="dash-filter-select h-9 rounded-lg border px-3 text-xs"
            placeholder="Latitude"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            required
          />
          <input
            className="dash-filter-select h-9 rounded-lg border px-3 text-xs"
            placeholder="Longitude"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <input
              className="dash-filter-select h-9 w-full rounded-lg border px-3 text-xs"
              placeholder="Radius m"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(e.target.value)}
            />
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg bg-primary-900 px-3 text-xs font-medium text-white hover:bg-primary-800 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
