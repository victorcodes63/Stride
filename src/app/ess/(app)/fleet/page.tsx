'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, MapPin, Truck } from 'lucide-react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssAlert, EssCard, EssEmptyState, essInputClass, essPrimaryButtonClass } from '@/components/ess/EssUi';
import { EssStatusPill } from '@/components/ess/EssStatusPill';
import { toast } from '@/components/ui/toast';
import { DRIVER_TRIP_STATUS_TRANSITIONS } from '@/lib/ess-fleet';
import type { FleetTripStatus } from '@prisma/client';
import { FLEET_TRIP_STATUS_LABELS } from '@/lib/fleet-status';

type TripRow = {
  id: string;
  tripNumber: string;
  status: FleetTripStatus;
  statusLabel: string;
  origin: string;
  destination: string;
  customerName: string;
  vehicleRegistration: string | null;
  plannedDeliveryAt: string | null;
};

const STATUS_BUTTON_LABELS: Partial<Record<FleetTripStatus, string>> = {
  loaded: 'Mark loaded',
  in_transit: 'Start trip',
  delivered: 'Mark delivered',
};

export default function EssFleetPage() {
  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [error, setError] = useState('');
  const [busyTripId, setBusyTripId] = useState<string | null>(null);
  const [noteByTrip, setNoteByTrip] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [podTripId, setPodTripId] = useState<string | null>(null);

  async function loadTrips() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ess/fleet/trips');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not load trips.');
        setTrips([]);
        return;
      }
      setDriverName(data.driver?.fullName ?? null);
      setTrips(Array.isArray(data.trips) ? data.trips : []);
    } catch {
      setError('Could not load trips.');
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrips();
  }, []);

  async function updateStatus(trip: TripRow) {
    const options = DRIVER_TRIP_STATUS_TRANSITIONS[trip.status] ?? [];
    const next = options[0];
    if (!next) return;

    setBusyTripId(trip.id);
    try {
      const res = await fetch(`/api/ess/fleet/trips/${trip.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, note: noteByTrip[trip.id] ?? '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not update trip.');
        return;
      }
      toast.success(`Trip updated to ${FLEET_TRIP_STATUS_LABELS[next]}.`);
      await loadTrips();
    } catch {
      toast.error('Could not update trip.');
    } finally {
      setBusyTripId(null);
    }
  }

  function openPodPicker(tripId: string) {
    setPodTripId(tripId);
    fileInputRef.current?.click();
  }

  async function onPodSelected(file: File | null) {
    if (!file || !podTripId) return;
    setBusyTripId(podTripId);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', `POD — ${file.name}`);
      const res = await fetch(`/api/ess/fleet/trips/${podTripId}/pod`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not upload POD.');
        return;
      }
      toast.success('Proof of delivery uploaded.');
      await loadTrips();
    } catch {
      toast.error('Could not upload POD.');
    } finally {
      setBusyTripId(null);
      setPodTripId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-5">
      <EssPageHeader
        title="My trips"
        subtitle={
          driverName
            ? `Active assignments for ${driverName}`
            : 'Trip updates and proof of delivery for assigned drivers.'
        }
        backHref="/ess/work"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => onPodSelected(e.target.files?.[0] ?? null)}
      />

      {error ? <EssAlert tone="danger">{error}</EssAlert> : null}

      {loading ? (
        <EssCard className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--ess-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading trips…
        </EssCard>
      ) : !driverName ? (
        <EssEmptyState
          title="No driver profile"
          message="Your employee record is not linked to a fleet driver profile. Contact operations if you should see trips here."
          icon={<Truck className="h-6 w-6" />}
        />
      ) : trips.length === 0 ? (
        <EssEmptyState
          title="No active trips"
          message="When operations assign you a trip, it will appear here for status updates and POD capture."
          icon={<Truck className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => {
            const nextOptions = DRIVER_TRIP_STATUS_TRANSITIONS[trip.status] ?? [];
            const nextStatus = nextOptions[0];
            const busy = busyTripId === trip.id;

            return (
              <EssCard key={trip.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ess-muted)]">
                      {trip.tripNumber}
                    </p>
                    <p className="text-base font-bold text-[var(--ess-text)]">{trip.customerName}</p>
                  </div>
                  <EssStatusPill status={trip.statusLabel || trip.status} />
                </div>

                <div className="flex items-start gap-2 text-sm text-[var(--ess-text)]">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ess-muted)]" />
                  <div>
                    <p>{trip.origin}</p>
                    <p className="text-[var(--ess-muted)]">→ {trip.destination}</p>
                    {trip.vehicleRegistration ? (
                      <p className="mt-1 text-xs text-[var(--ess-muted)]">Vehicle {trip.vehicleRegistration}</p>
                    ) : null}
                  </div>
                </div>

                {nextStatus ? (
                  <textarea
                    rows={2}
                    placeholder="Optional note for dispatch"
                    value={noteByTrip[trip.id] ?? ''}
                    onChange={(e) =>
                      setNoteByTrip((prev) => ({ ...prev, [trip.id]: e.target.value }))
                    }
                    className={`${essInputClass} min-h-16`}
                  />
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row">
                  {nextStatus ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => updateStatus(trip)}
                      className={`${essPrimaryButtonClass} flex-1`}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        STATUS_BUTTON_LABELS[nextStatus] ?? `Set ${FLEET_TRIP_STATUS_LABELS[nextStatus]}`
                      )}
                    </button>
                  ) : null}
                  {['in_transit', 'delivered', 'exception'].includes(trip.status) ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openPodPicker(trip.id)}
                      className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--ess-border)] bg-white px-4 text-sm font-bold text-[var(--ess-text)]"
                    >
                      <Camera className="h-4 w-4" />
                      Upload POD
                    </button>
                  ) : null}
                </div>
              </EssCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
