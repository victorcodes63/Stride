'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ClipboardList, Route, Truck } from 'lucide-react';
import {
  DashboardAsyncState,
  DashboardPageSkeleton,
} from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import type { FleetTripListRow } from '@/lib/fleet-api';
import { fleetTripStatusBadgeClass } from '@/lib/fleet-status';

type Overview = {
  vehicles: { total: number; available: number; inTransit: number; maintenance: number };
  trips: { total: number; active: number; delivered: number; exception: number };
  settlements?: { pending: number };
  incidents?: { open: number };
};

export default function FleetOverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trips, setTrips] = useState<FleetTripListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [overviewRes, tripsRes] = await Promise.all([
          fetch('/api/fleet/overview'),
          fetch('/api/fleet/trips'),
        ]);
        if (!overviewRes.ok || !tripsRes.ok) {
          const failed = !overviewRes.ok ? overviewRes : tripsRes;
          const data = (await failed.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || 'Unable to load fleet data.');
        }
        const overviewJson = (await overviewRes.json()) as Overview;
        const tripsJson = (await tripsRes.json()) as FleetTripListRow[];
        if (!cancelled) {
          setOverview(overviewJson);
          setTrips(tripsJson.slice(0, 8));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load fleet data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const listStatus = loading ? 'loading' : error ? 'error' : 'success';

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Operations overview"
        description="Live trips, fleet availability, and exceptions across your logistics workflow."
        actions={
          <Link
            href="/dashboard/fleet/trips"
            className="inline-flex h-9 items-center rounded-md bg-primary-500 px-4 text-sm font-medium text-white hover:bg-primary-600"
          >
            Open trip board
          </Link>
        }
      />

      <DashboardAsyncState
        status={listStatus}
        error={error}
        loading={<DashboardPageSkeleton variant="stats" />}
      >
        {overview ? (
          <>
            <DashboardStatGrid>
              <DashboardStatCard label="Active trips" value={overview.trips.active} icon={Route} />
              <DashboardStatCard
                label="Vehicles available"
                value={overview.vehicles.available}
                icon={Truck}
              />
              <DashboardStatCard label="In transit" value={overview.vehicles.inTransit} icon={Truck} />
              <DashboardStatCard
                label="Open exceptions"
                value={overview.trips.exception}
                icon={Route}
                tone={overview.trips.exception > 0 ? 'warning' : 'primary'}
              />
              <DashboardStatCard
                label="Pending settlements"
                value={overview.settlements?.pending ?? 0}
                icon={ClipboardList}
              />
              <DashboardStatCard
                label="Open incidents"
                value={overview.incidents?.open ?? 0}
                icon={AlertTriangle}
                tone={(overview.incidents?.open ?? 0) > 0 ? 'warning' : 'primary'}
              />
            </DashboardStatGrid>

            <div className="mb-6 flex flex-wrap gap-3 text-sm">
              <Link href="/dashboard/fleet/compliance" className="font-medium text-primary-600 hover:underline">
                Compliance dashboard
              </Link>
              <Link href="/dashboard/fleet/settlements" className="font-medium text-primary-600 hover:underline">
                Settlements queue
              </Link>
              <Link href="/dashboard/fleet/billing" className="font-medium text-primary-600 hover:underline">
                Client billing
              </Link>
              <Link href="/dashboard/fleet/incidents" className="font-medium text-primary-600 hover:underline">
                Incidents
              </Link>
            </div>

            <DashboardTableCard>
              <div className="border-b border-neutral-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-ink">Recent trips</h2>
              </div>
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
          </>
        ) : null}
      </DashboardAsyncState>
    </DashboardPage>
  );
}
