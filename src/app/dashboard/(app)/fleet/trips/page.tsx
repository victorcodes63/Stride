'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import type { FleetTripListRow } from '@/lib/fleet-api';
import {
  FLEET_TRIP_BOARD_COLUMNS,
  fleetTripStatusBadgeClass,
} from '@/lib/fleet-status';

export default function FleetTripsPage() {
  const [trips, setTrips] = useState<FleetTripListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/fleet/trips');
        if (!res.ok) throw new Error('Unable to load trips.');
        const json = (await res.json()) as FleetTripListRow[];
        if (!cancelled) setTrips(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load trips.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, FleetTripListRow[]>();
    for (const col of FLEET_TRIP_BOARD_COLUMNS) map.set(col.id, []);
    for (const trip of trips) {
      const bucket = map.get(trip.status) ?? [];
      bucket.push(trip);
      map.set(trip.status, bucket);
    }
    return map;
  }, [trips]);

  const listStatus = loading ? 'loading' : error ? 'error' : 'success';

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Trip board"
        description="Transport workflow from order intake through delivery, settlement, and billing."
      />

      <DashboardAsyncState status={listStatus} error={error}>
        <div className="-mx-1 flex gap-4 overflow-x-auto pb-2">
          {FLEET_TRIP_BOARD_COLUMNS.map((column) => {
            const items = grouped.get(column.id) ?? [];
            return (
              <section
                key={column.id}
                className="min-h-[320px] min-w-[220px] flex-1 rounded-xl border border-neutral-200 bg-white/90"
              >
                <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                    {column.label}
                  </h2>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                    {items.length}
                  </span>
                </header>
                <ul className="space-y-3 p-3">
                  {items.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-500">
                      No trips
                    </li>
                  ) : (
                    items.map((trip) => (
                      <li key={trip.id}>
                        <Link
                          href={`/dashboard/fleet/trips/${trip.id}`}
                          className="block rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-primary-200 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-ink">{trip.tripNumber}</p>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${fleetTripStatusBadgeClass(trip.status)}`}
                            >
                              {trip.statusLabel}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-neutral-600">
                            {trip.origin} → {trip.destination}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">{trip.customerName}</p>
                          {trip.vehicleRegistration ? (
                            <p className="mt-2 text-[11px] font-medium text-neutral-700">
                              {trip.vehicleRegistration}
                              {trip.driverName ? ` · ${trip.driverName}` : ''}
                            </p>
                          ) : null}
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </DashboardAsyncState>
    </DashboardPage>
  );
}
