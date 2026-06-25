'use client';

import { useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

export default function HealthcareNhifPage() {
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [extract, setExtract] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const month = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    void Promise.all([
      fetch('/api/healthcare/nhif/overview').then((r) => r.json()),
      fetch(`/api/healthcare/nhif/returns?month=${month}`).then((r) => r.json()),
    ])
      .then(([ov, ex]) => {
        setOverview(ov);
        setExtract(ex.extract ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [month]);

  if (loading) return <DashboardPageSkeleton />;

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Healthcare"
        title="NHIF / SHIF compliance"
        description="Employer registration, member numbers on file, and monthly return extract from payroll."
      />
      {error ? (
        <DashboardAsyncState variant="error" title="NHIF" message={error} />
      ) : (
        <div className="space-y-6">
          <pre className="overflow-auto rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 text-xs">
            {JSON.stringify(overview, null, 2)}
          </pre>
          <h2 className="text-sm font-semibold text-[var(--dash-text)]">Return extract — {month}</h2>
          <pre className="overflow-auto rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 text-xs">
            {JSON.stringify(extract, null, 2)}
          </pre>
        </div>
      )}
    </DashboardPage>
  );
}
