'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardAsyncState,
  DashboardPageSkeleton,
} from '@/components/dashboard/DashboardAsyncState';

type Overview = {
  summary: {
    memberCount: number;
    activeMembers: number;
    sharesTotal: number;
    bosaTotal: number;
    fosaTotal: number;
  };
  latestDividendRun: {
    label: string;
    status: string;
    totalAmount: number | null;
  } | null;
};

function formatKes(value: number) {
  return `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

export default function SaccoOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/sacco/overview')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to load SACCO overview');
        if (!cancelled) setData(json as Overview);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <DashboardPageSkeleton />;
  if (error || !data) {
    return (
      <DashboardPage>
        <DashboardAsyncState variant="error" title="Unable to load SACCO" message={error ?? 'Unknown error'} />
      </DashboardPage>
    );
  }

  const { summary, latestDividendRun } = data;

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="SACCO vertical"
        title="Member operations"
        description="Member register, BOSA/FOSA ledger, dividend runs, and SASRA-aligned reporting."
        actions={
          <Link href="/dashboard/sacco/members" className="btn-primary inline-flex items-center gap-2">
            Manage members
          </Link>
        }
      />

      <DashboardStatGrid>
        <DashboardStatCard label="Members" value={String(summary.memberCount)} hint={`${summary.activeMembers} active`} />
        <DashboardStatCard label="Share capital" value={formatKes(summary.sharesTotal)} />
        <DashboardStatCard label="BOSA savings" value={formatKes(summary.bosaTotal)} />
        <DashboardStatCard label="FOSA deposits" value={formatKes(summary.fosaTotal)} />
      </DashboardStatGrid>

      {latestDividendRun ? (
        <div className="mt-6 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
            Latest dividend run
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--dash-text)]">{latestDividendRun.label}</p>
          <p className="text-sm text-[var(--dash-text-muted)]">
            {latestDividendRun.status}
            {latestDividendRun.totalAmount != null
              ? ` · ${formatKes(latestDividendRun.totalAmount)}`
              : ''}
          </p>
          <Link href="/dashboard/sacco/dividends" className="mt-2 inline-block text-sm font-medium text-primary-600">
            View dividend runs →
          </Link>
        </div>
      ) : null}
    </DashboardPage>
  );
}
