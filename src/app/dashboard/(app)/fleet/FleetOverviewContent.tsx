'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';
import { ModuleHomeContent } from '@/components/dashboard/module-home/ModuleHomeContent';
import { DashboardPageSection } from '@/components/dashboard/DashboardPage';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import type { FleetTripListRow } from '@/lib/fleet-api';
import { fleetTripStatusBadgeClass } from '@/lib/fleet-status';

export default function FleetOverviewContent() {
  const [trips, setTrips] = useState<FleetTripListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/fleet/trips', { credentials: 'include' });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || 'Unable to load recent trips.');
        }
        const tripsJson = (await res.json()) as FleetTripListRow[];
        if (!cancelled) setTrips(tripsJson.slice(0, 8));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load recent trips.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-0">
      <ModuleHomeContent domainId="fleet-logistics" />

      <DashboardPageSection className="mt-8 border-t border-[var(--dash-border)] pt-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--dash-text-strong)]">Recent trips</h2>
            <p className="mt-0.5 text-sm text-[var(--dash-text-muted)]">
              Latest movements across the trip board.
            </p>
          </div>
          <Link
            href="/dashboard/fleet/trips"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-[var(--stride-coral)] hover:underline"
          >
            Trip board
          </Link>
        </div>

        {error ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12 text-[var(--dash-text-muted)]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading trips…
          </div>
        ) : (
          <DashboardTableCard>
            <DashboardTableViewport>
              {trips.length === 0 ? (
                <DashboardTableEmpty
                  title="No trips yet"
                  description="Run the fleet demo seed or create transport orders to populate the trip board."
                />
              ) : (
                <DashboardTable>
                  <thead>
                    <tr>
                      <th>Trip</th>
                      <th>Route</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th className="col-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map((trip) => (
                      <tr key={trip.id}>
                        <td className="col-primary font-medium">{trip.tripNumber}</td>
                        <td className="col-muted">
                          {trip.origin} → {trip.destination}
                        </td>
                        <td>{trip.customerName}</td>
                        <td>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${fleetTripStatusBadgeClass(trip.status)}`}
                          >
                            {trip.statusLabel}
                          </span>
                        </td>
                        <td className="col-right">
                          <Link
                            href={`/dashboard/fleet/trips/${trip.id}`}
                            className="text-sm font-medium text-primary-600 hover:text-primary-700"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
              )}
            </DashboardTableViewport>
          </DashboardTableCard>
        )}
      </DashboardPageSection>
    </div>
  );
}
