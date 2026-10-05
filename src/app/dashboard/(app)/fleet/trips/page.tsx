'use client';

import { useEffect, useState } from 'react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import type { FleetTripListRow } from '@/lib/fleet-api';
import { FleetTripBoard } from '@/components/fleet/FleetTripBoard';

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

  const listStatus = loading ? 'loading' : error ? 'error' : 'success';

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Trip board"
        description="Transport workflow from order intake through delivery, settlement, and billing."
      />

      <DashboardAsyncState status={listStatus} error={error}>
        <FleetTripBoard trips={trips} />
      </DashboardAsyncState>
    </DashboardPage>
  );
}
