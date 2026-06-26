'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, Route } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardMetricCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { DashboardTableCard } from '@/components/dashboard/DashboardDataTable';

type PlanResult = {
  origin: string;
  destination: string;
  distanceKm: number;
  fuelLitersEstimate: number;
  transitHoursEstimate: number;
  estimatedArrival: string;
  meetsDeadline: boolean | null;
  suggestedVehicles: { id: string; registration: string; label: string | null; capacityKg: number | null }[];
  suggestedDrivers: { id: string; fullName: string; licenceClass: string | null }[];
};

export default function FleetPlanningPage() {
  const [origin, setOrigin] = useState('Nairobi — Industrial Area');
  const [destination, setDestination] = useState('Mombasa — Port Reitz');
  const [distanceKm, setDistanceKm] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePlan(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fleet/planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          distanceKm: distanceKm ? parseInt(distanceKm, 10) : undefined,
        }),
      });
      const data = (await res.json()) as PlanResult & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Planning failed.');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Planning failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Route planning"
        description="Estimate distance, fuel consumption, transit time, and available fleet before dispatch."
      />

      <DashboardTableCard className="mb-6">
        <form onSubmit={handlePlan} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Origin</span>
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Destination</span>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Distance (km, optional)</span>
            <input
              type="number"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              placeholder="Auto-estimate"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? 'Calculating…' : 'Plan route'}
            </button>
          </div>
        </form>
        {error ? <p className="px-5 pb-4 text-sm text-red-600">{error}</p> : null}
      </DashboardTableCard>

      {result ? (
        <>
          <DashboardStatGrid>
            <DashboardMetricCard label="Distance" value={`${result.distanceKm} km`} icon={MapPin} />
            <DashboardMetricCard
              label="Fuel estimate"
              value={`${result.fuelLitersEstimate} L`}
              icon={Route}
            />
            <DashboardMetricCard
              label="Transit time"
              value={`${result.transitHoursEstimate} hrs`}
              icon={Route}
            />
            <DashboardMetricCard
              label="ETA"
              value={new Date(result.estimatedArrival).toLocaleDateString()}
              icon={Route}
              tone={result.meetsDeadline === false ? 'warning' : 'primary'}
            />
          </DashboardStatGrid>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <DashboardTableCard>
              <div className="border-b border-neutral-200 px-5 py-3">
                <h2 className="text-sm font-semibold">Suggested vehicles</h2>
              </div>
              <ul className="divide-y divide-neutral-100 p-3">
                {result.suggestedVehicles.length === 0 ? (
                  <li className="px-2 py-4 text-sm text-neutral-500">No available vehicles.</li>
                ) : (
                  result.suggestedVehicles.map((v) => (
                    <li key={v.id} className="flex justify-between px-2 py-2 text-sm">
                      <span className="font-medium">{v.registration}</span>
                      <span className="text-neutral-500">{v.label ?? v.capacityKg ? `${v.capacityKg} kg` : ''}</span>
                    </li>
                  ))
                )}
              </ul>
            </DashboardTableCard>
            <DashboardTableCard>
              <div className="border-b border-neutral-200 px-5 py-3">
                <h2 className="text-sm font-semibold">Suggested drivers</h2>
              </div>
              <ul className="divide-y divide-neutral-100 p-3">
                {result.suggestedDrivers.length === 0 ? (
                  <li className="px-2 py-4 text-sm text-neutral-500">No available drivers.</li>
                ) : (
                  result.suggestedDrivers.map((d) => (
                    <li key={d.id} className="flex justify-between px-2 py-2 text-sm">
                      <span className="font-medium">{d.fullName}</span>
                      <span className="text-neutral-500">Class {d.licenceClass ?? '—'}</span>
                    </li>
                  ))
                )}
              </ul>
            </DashboardTableCard>
          </div>

          <p className="mt-4 text-sm text-neutral-600">
            Next:{' '}
            <Link href="/dashboard/fleet/orders" className="font-medium text-primary-600 hover:underline">
              create a transport order
            </Link>{' '}
            or{' '}
            <Link href="/dashboard/fleet/trips" className="font-medium text-primary-600 hover:underline">
              open the trip board
            </Link>{' '}
            to allocate and dispatch.
          </p>
        </>
      ) : null}
    </DashboardPage>
  );
}
