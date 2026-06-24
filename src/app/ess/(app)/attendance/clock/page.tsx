'use client';

import { useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { toast } from '@/components/ui/toast';
import { EssAlert, EssCard } from '@/components/ess/EssUi';

export default function EssClockPage() {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ kind: string; at: string } | null>(null);

  async function punch(kind: 'check_in' | 'check_out') {
    if (!navigator.onLine) {
      toast.error('You are offline. Reconnect before clocking in or out.');
      return;
    }
    setBusy(true);
    let latitude: number | undefined;
    let longitude: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
      });
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch {
      // geo optional
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
    setLast({ kind: data.kind, at: data.observedAt });
    toast.success(kind === 'check_in' ? 'Clocked in' : 'Clocked out');
  }

  return (
    <div className="space-y-5">
      <EssPageHeader title="Clock in / out" subtitle="Capture your attendance with optional location verification." backHref="/ess/attendance" />
      <EssCard className="flex flex-col items-center gap-6 py-8">
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
          </p>
        ) : null}
        <p className="max-w-xs text-center text-xs text-[var(--ess-muted)]">
          Location is captured when permitted. HR may configure geofencing in a future update.
        </p>
      </EssCard>
      <EssAlert>Clock actions require a live connection so the timestamp reaches HR immediately.</EssAlert>
    </div>
  );
}
