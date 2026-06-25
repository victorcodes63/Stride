'use client';

import { useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

const TEMPLATES = [
  { id: 'quarterly_summary', label: 'Quarterly prudential summary' },
  { id: 'loan_classification', label: 'Loan classification snapshot' },
  { id: 'membership_register', label: 'Membership register extract' },
] as const;

export default function SaccoReportsPage() {
  const [template, setTemplate] = useState<string>('quarterly_summary');
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch(`/api/sacco/reports/sasra?template=${template}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to load report');
        if (!cancelled) setReport(json.report as Record<string, unknown>);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load report');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [template]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="SACCO"
        title="SASRA report templates"
        description="Board-ready extracts aligned to SASRA filing workflows (illustrative forms for demo)."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTemplate(t.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              template === t.id
                ? 'bg-primary-500 text-white'
                : 'bg-[var(--dash-surface-raised)] text-[var(--dash-text-muted)] ring-1 ring-[var(--dash-border)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <DashboardPageSkeleton />
      ) : error ? (
        <DashboardAsyncState variant="error" title="SASRA report" message={error} />
      ) : (
        <pre className="overflow-auto rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 text-xs leading-relaxed text-[var(--dash-text)]">
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
    </DashboardPage>
  );
}
