'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { StrideSelect } from '@/components/ui/stride-select';

type PerformanceReport = {
  periodDays: number;
  filters?: { vehicleId: string | null; partnerId: string | null };
  trips: { total: number; delivered: number; onTimeDeliveries: number; onTimePct: number };
  fleet: { total: number; inTransit: number; utilizationPct: number };
  fuel: { liters: number; spendKes: number };
  settlements: { totalAmountKes: number };
  transporterScorecard: { payeeName: string; tripCount: number; totalPaidKes: number }[];
  incidents: { escalatedHighSeverity: number };
};

type VehicleOption = { id: string; registration: string; label: string | null };
type PartnerOption = { id: string; name: string };

const PERIOD_OPTIONS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Year to date', days: 365 },
];

export default function FleetReportsPage() {
  const [periodDays, setPeriodDays] = useState(30);
  const [vehicleId, setVehicleId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([fetch('/api/fleet/vehicles'), fetch('/api/fleet/partners')])
      .then(async ([vehiclesRes, partnersRes]) => {
        if (vehiclesRes.ok) {
          const rows = (await vehiclesRes.json()) as VehicleOption[];
          setVehicles(Array.isArray(rows) ? rows : []);
        }
        if (partnersRes.ok) {
          const rows = (await partnersRes.json()) as PartnerOption[];
          setPartners(Array.isArray(rows) ? rows : []);
        }
      })
      .catch(() => undefined);
  }, []);

  const exportQuery = useMemo(() => {
    const params = new URLSearchParams({ days: String(periodDays) });
    if (vehicleId) params.set('vehicleId', vehicleId);
    if (partnerId) params.set('partnerId', partnerId);
    return params.toString();
  }, [periodDays, vehicleId, partnerId]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fleet/reports/performance?${exportQuery}`);
      if (!res.ok) throw new Error('Unable to load performance report.');
      setReport((await res.json()) as PerformanceReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [exportQuery]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Performance reports"
        description="Utilisation, trip volumes, delivery performance, and fuel usage."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-neutral-600">
              <span className="sr-only">Report period</span>
              <StrideSelect
                value={String(periodDays)}
                onChange={(value) => setPeriodDays(Number(value))}
                options={PERIOD_OPTIONS.map((opt) => ({
                  value: String(opt.days),
                  label: opt.label,
                }))}
                ariaLabel="Report period"
              />
            </label>
            <label className="text-sm text-neutral-600">
              <span className="sr-only">Vehicle filter</span>
              <StrideSelect
                value={vehicleId}
                onChange={(value) => setVehicleId(value)}
                options={[
                  { value: '', label: 'All vehicles' },
                  ...vehicles.map((v) => ({
                    value: v.id,
                    label: `${v.registration}${v.label ? ` — ${v.label}` : ''}`,
                  })),
                ]}
                ariaLabel="Vehicle filter"
              />
            </label>
            <label className="text-sm text-neutral-600">
              <span className="sr-only">Partner filter</span>
              <StrideSelect
                value={partnerId}
                onChange={(value) => setPartnerId(value)}
                options={[
                  { value: '', label: 'All partners' },
                  ...partners.map((p) => ({ value: p.id, label: p.name })),
                ]}
                ariaLabel="Partner filter"
              />
            </label>
            <a
              href={`/api/fleet/reports/performance?${exportQuery}&format=csv`}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </a>
            <a
              href={`/api/fleet/reports/performance?${exportQuery}&format=pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </a>
          </div>
        }
      />

      <DashboardAsyncState
        status={loading ? 'loading' : error ? 'error' : 'success'}
        error={error}
        loading={<DashboardPageSkeleton variant="stats" />}
      >
        {report ? (
          <>
            <p className="mb-4 text-sm text-neutral-600">
              Showing metrics for the last {report.periodDays} days
              {vehicleId || partnerId ? ' (filtered)' : ''}.
            </p>
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
              </ul>
            </DashboardTableCard>
          </>
        ) : null}
      </DashboardAsyncState>
    </DashboardPage>
  );
}
