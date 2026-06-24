'use client';

import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { toast } from '@/components/ui/toast';
import { EssAlert, EssCard } from '@/components/ess/EssUi';

type ClockConfig = {
  geofenceEnabled: boolean;
  requireLocation: boolean;
  rejectOutsideGeofence: boolean;
  workSiteCount: number;
};

export default function EssClockPage() {
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<ClockConfig | null>(null);
  const [last, setLast] = useState<{ kind: string; at: string; siteName?: string | null } | null>(null);

  useEffect(() => {
    void fetch('/api/ess/attendance/clock', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch(() => setConfig(null));
  }, []);

  async function punch(kind: 'check_in' | 'check_out') {
    if (!navigator.onLine) {
      toast.error('You are offline. Reconnect before clocking in or out.');
      return;
    }
    setBusy(true);
    let latitude: number | undefined;
    let longitude: number | undefined;
    const requireLocation = config?.requireLocation ?? false;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000, enableHighAccuracy: true });
      });
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch {
      if (requireLocation) {
        setBusy(false);
        toast.error('Location is required to clock in at your work site.');
        return;
      }
    }

    const res = await fetch('/api/ess/attendance/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, latitude, longitude }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error || 'Clock failed.');
      return;
    }
    setLast({ kind: data.kind, at: data.observedAt, siteName: data.geofence?.siteName });
    const siteLabel = data.geofence?.siteName ? ` at ${data.geofence.siteName}` : '';
    toast.success(kind === 'check_in' ? `Clocked in${siteLabel}` : `Clocked out${siteLabel}`);
  }

  return (
    <div className="space-y-5">
      <EssPageHeader
        title="Clock in / out"
        subtitle="Capture your attendance with GPS verification when your employer enables geofencing."
        backHref="/ess/attendance"
      />
      <EssCard className="flex flex-col items-center gap-6 py-8">
        {config?.geofenceEnabled ? (
          <p className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            Geofence active · {config.workSiteCount} work site{config.workSiteCount === 1 ? '' : 's'}
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => punch('check_in')}
          className="flex h-44 w-44 items-center justify-center rounded-full bg-emerald-600 text-lg font-black text-white shadow-[0_24px_60px_rgba(22,163,74,0.28)] disabled:opacity-60"
        >
          Clock in
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => punch('check_out')}
          className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-[var(--ess-primary)] bg-[var(--ess-surface)] text-base font-black text-[var(--ess-primary)] disabled:opacity-60"
        >
          Clock out
        </button>
        {last ? (
          <p className="text-sm text-[var(--ess-muted)]">
            Last: {last.kind.replace('_', ' ')} at {new Date(last.at).toLocaleString()}
            {last.siteName ? ` · ${last.siteName}` : ''}
          </p>
        ) : null}
        <p className="max-w-xs text-center text-xs text-[var(--ess-muted)]">
          {config?.geofenceEnabled
            ? config.rejectOutsideGeofence
              ? 'You must be within an approved work site to clock in. Ask your manager if you are working remotely.'
              : 'Clock-ins outside a work site are flagged for manager review.'
            : 'Location is captured when permitted to support attendance verification.'}
        </p>
      </EssCard>
      <EssAlert>Clock actions require a live connection so the timestamp reaches HR immediately.</EssAlert>
    </div>
  );
}
