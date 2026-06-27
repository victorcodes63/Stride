'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart2, Download, Route, Truck } from 'lucide-react';
import {
  DashboardAsyncState,
  DashboardPageSkeleton,
} from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardMetricCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { DashboardTableCard } from '@/components/dashboard/DashboardDataTable';

type PerformanceReport = {
  periodDays: number;
  trips: { total: number; delivered: number; onTimeDeliveries: number; onTimePct: number };
  fleet: { total: number; inTransit: number; utilizationPct: number };
  fuel: { liters: number; spendKes: number };
  settlements: { totalAmountKes: number };
  transporterScorecard: { payeeName: string; tripCount: number; totalPaidKes: number }[];
  incidents: { escalatedHighSeverity: number };
};

export default function FleetReportsPage() {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/fleet/reports/performance?days=30')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load performance report.');
        setReport((await r.json()) as PerformanceReport);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Performance reports"
        description="Fleet utilisation, trip volumes, delivery performance, fuel usage, and settlement totals — last 30 days."
        actions={
          <a
            href="/api/fleet/reports/performance?days=30&format=csv"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
        }
      />

      <DashboardAsyncState
        status={loading ? 'loading' : error ? 'error' : 'success'}
        error={error}
        loading={<DashboardPageSkeleton variant="stats" />}
      >
        {report ? (
          <>
            <DashboardStatGrid>
              <DashboardMetricCard label="Trips" value={report.trips.total} icon={Route} />
              <DashboardMetricCard label="Delivered" value={report.trips.delivered} icon={Route} tone="success" />
              <DashboardMetricCard
                label="On-time %"
                value={`${report.trips.onTimePct}%`}
                icon={Route}
                tone="success"
              />
              <DashboardMetricCard
                label="Fleet utilisation"
                value={`${report.fleet.utilizationPct}%`}
                icon={Truck}
              />
              <DashboardMetricCard
                label="Fuel spend"
                value={`KES ${report.fuel.spendKes.toLocaleString()}`}
                icon={BarChart2}
              />
              <DashboardMetricCard
                label="Settlements"
                value={`KES ${report.settlements.totalAmountKes.toLocaleString()}`}
                icon={BarChart2}
              />
              <DashboardMetricCard label="On-time deliveries" value={report.trips.onTimeDeliveries} icon={Route} />
              <DashboardMetricCard
                label="Escalated incidents"
                value={report.incidents.escalatedHighSeverity}
                icon={BarChart2}
                tone={report.incidents.escalatedHighSeverity > 0 ? 'danger' : 'neutral'}
              />
            </DashboardStatGrid>

            {report.transporterScorecard.length > 0 ? (
              <DashboardTableCard className="mt-6 p-5">
                <h2 className="mb-3 text-sm font-semibold text-ink">Transporter scorecard</h2>
                <ul className="space-y-2 text-sm text-neutral-700">
                  {report.transporterScorecard.map((row) => (
                    <li key={row.payeeName} className="flex justify-between gap-4 border-b border-neutral-100 py-2 last:border-0">
                      <span className="font-medium text-ink">{row.payeeName}</span>
                      <span>
                        {row.tripCount} trips · KES {row.totalPaidKes.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </DashboardTableCard>
            ) : null}

            <DashboardTableCard className="mt-6 p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Workflow integrations</h2>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li>
                  <strong>HR & Payroll:</strong> Driver records link to employees — settlements feed payroll via{' '}
                  <Link href="/dashboard/fleet/settlements" className="text-primary-600 hover:underline">
                    settlements queue
                  </Link>
                  .
                </li>
                <li>
                  <strong>Accounts:</strong> Fleet customer debtors bill through{' '}
                  <Link href="/dashboard/fleet/billing" className="text-primary-600 hover:underline">
                    client billing
                  </Link>{' '}
                  with AR ageing.
                </li>
              </ul>
            </DashboardTableCard>
          </>
        ) : null}
      </DashboardAsyncState>
    </DashboardPage>
  );
}
