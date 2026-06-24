'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  DashboardAsyncState,
  DashboardPageSkeleton,
} from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import type { FleetTripDetail } from '@/lib/fleet-api';
import {
  FLEET_TRIP_STATUSES,
  FLEET_TRIP_STATUS_LABELS,
  fleetTripStatusBadgeClass,
} from '@/lib/fleet-status';
import { FleetTripComplianceSection } from '@/components/fleet/FleetTripComplianceSection';
import { FleetTripDocumentsSection } from '@/components/fleet/FleetTripDocumentsSection';

export default function FleetTripDetailPage() {
  const params = useParams<{ id: string }>();
  const tripId = params.id;
  const [trip, setTrip] = useState<FleetTripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadTrip = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fleet/trips/${tripId}`);
      if (!res.ok) throw new Error('Trip not found.');
      setTrip((await res.json()) as FleetTripDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load trip.');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  async function updateStatus(status: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/fleet/trips/${tripId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Unable to update trip status.');
      setTrip((await res.json()) as FleetTripDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update trip status.');
    } finally {
      setSaving(false);
    }
  }

  const pageStatus = loading ? 'loading' : error ? 'error' : !trip ? 'empty' : 'success';

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title={trip?.tripNumber ?? 'Trip'}
        description={trip ? `${trip.origin} → ${trip.destination}` : 'Trip detail and workflow timeline.'}
        actions={
          <Link href="/dashboard/fleet/trips" className="text-sm font-medium text-primary-600 hover:underline">
            Back to trip board
          </Link>
        }
      />

      <DashboardAsyncState
        status={pageStatus}
        error={error}
        onRetry={() => void loadTrip()}
        empty={
          <p className="text-sm text-neutral-500">Trip not found.</p>
        }
        loading={<DashboardPageSkeleton variant="detail" />}
      >
        {trip ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <section className="rounded-xl border border-neutral-200 bg-white p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${fleetTripStatusBadgeClass(trip.status)}`}
                  >
                    {trip.statusLabel}
                  </span>
                  {trip.isOutsourced ? (
                    <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Outsourced
                    </span>
                  ) : null}
                </div>
                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Customer</dt>
                    <dd className="mt-1 text-sm text-ink">{trip.customerName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Cargo</dt>
                    <dd className="mt-1 text-sm text-ink">{trip.cargoType ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Vehicle</dt>
                    <dd className="mt-1 text-sm text-ink">{trip.vehicleRegistration ?? 'Unassigned'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Driver / partner</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {trip.driverName ?? trip.partnerName ?? 'Unassigned'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Planned delivery</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {trip.plannedDeliveryAt
                        ? new Date(trip.plannedDeliveryAt).toLocaleString()
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Distance (km)</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {trip.actualDistanceKm ?? trip.plannedDistanceKm ?? '—'}
                    </dd>
                  </div>
                </dl>
                {trip.notes ? (
                  <p className="mt-6 rounded-lg bg-neutral-50 p-4 text-sm text-neutral-700">{trip.notes}</p>
                ) : null}
              </section>

              <FleetTripComplianceSection
                tripId={tripId}
                checks={trip.complianceChecks}
                complianceComplete={trip.complianceComplete}
                onUpdated={setTrip}
              />

              <FleetTripDocumentsSection
                tripId={tripId}
                documents={trip.documents}
                onUpdated={setTrip}
              />

              <section className="rounded-xl border border-neutral-200 bg-white p-6">
                <h2 className="text-sm font-semibold text-ink">Timeline</h2>
                <ul className="mt-4 space-y-4">
                  {trip.events.length === 0 ? (
                    <li className="text-sm text-neutral-500">No events logged yet.</li>
                  ) : (
                    trip.events.map((event) => (
                      <li key={event.id} className="border-l-2 border-primary-200 pl-4">
                        <p className="text-sm text-ink">{event.message}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {new Date(event.createdAt).toLocaleString()}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            </div>

            <aside className="rounded-xl border border-neutral-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-ink">Advance status</h2>
              <p className="mt-2 text-xs text-neutral-500">
                Move the trip through each logistics workflow stage.
              </p>
              <div className="mt-4 space-y-2">
                {FLEET_TRIP_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={saving || trip.status === status}
                    onClick={() => void updateStatus(status)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      trip.status === status
                        ? 'border-primary-500 bg-primary-50 font-semibold text-primary-800'
                        : 'border-neutral-200 hover:border-primary-200 hover:bg-neutral-50'
                    }`}
                  >
                    {FLEET_TRIP_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </aside>
          </div>
        ) : null}
      </DashboardAsyncState>
    </DashboardPage>
  );
}
