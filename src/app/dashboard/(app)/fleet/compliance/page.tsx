'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { fleetComplianceResultBadgeClass } from '@/lib/fleet-compliance';
import { ShieldCheck } from 'lucide-react';

type ComplianceOverview = {
  summary: { pending: number; failed: number; tripsWithIssues: number };
  trips: {
    id: string;
    tripNumber: string;
    status: string;
    origin: string;
    destination: string;
    customerName: string;
    openChecks: {
      checkLabel: string;
      result: string;
      resultLabel: string;
    }[];
  }[];
};

export default function FleetCompliancePage() {
  const [data, setData] = useState<ComplianceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/fleet/compliance/overview');
        if (!res.ok) throw new Error('Unable to load compliance overview.');
        const json = (await res.json()) as ComplianceOverview;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load compliance overview.');
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
        title="Compliance dashboard"
        description="Pre-trip checks still pending or failed before dispatch."
      />

      <DashboardAsyncState status={listStatus} error={error}>
        {data ? (
          <>
            <DashboardStatGrid>
              <DashboardStatCard
                label="Trips with open checks"
                value={data.summary.tripsWithIssues}
                icon={ShieldCheck}
              />
              <DashboardStatCard label="Pending checks" value={data.summary.pending} icon={ShieldCheck} />
              <DashboardStatCard
                label="Failed checks"
                value={data.summary.failed}
                icon={ShieldCheck}
                tone={data.summary.failed > 0 ? 'warning' : 'primary'}
              />
            </DashboardStatGrid>

            <DashboardTableCard>
              <DashboardTableViewport>
                {data.trips.length === 0 ? (
                  <DashboardTableEmpty
                    title="All clear"
                    description="No active trips have pending or failed compliance checks."
                  />
                ) : (
                  <DashboardTable>
                    <thead>
                      <tr>
                        <th>Trip</th>
                        <th>Customer</th>
                        <th>Open checks</th>
                        <th className="col-right"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trips.map((trip) => (
                        <tr key={trip.id}>
                          <td className="col-primary font-medium">
                            {trip.tripNumber}
                            <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                              {trip.origin} → {trip.destination}
                            </span>
                          </td>
                          <td>{trip.customerName}</td>
                          <td>
                            <ul className="space-y-1">
                              {trip.openChecks.map((check) => (
                                <li key={check.checkLabel} className="flex items-center gap-2 text-xs">
                                  <span>{check.checkLabel}</span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 font-medium ${fleetComplianceResultBadgeClass(check.result as never)}`}
                                  >
                                    {check.resultLabel}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="col-right">
                            <Link
                              href={`/dashboard/fleet/trips/${trip.id}`}
                              className="text-sm font-medium text-primary-600 hover:text-primary-700"
                            >
                              Review
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
