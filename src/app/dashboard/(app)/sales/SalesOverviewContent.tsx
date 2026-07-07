'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Target, TrendingUp, Handshake, Coins } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_STAT_CARD_CLASS } from '@/lib/dashboard-layout';

type AttainmentReport = {
  teamTotals: { target: number; actual: number; attainmentPct: number | null };
  periodStart: string;
  periodEnd: string;
  currency: string;
};

export default function SalesOverviewContent() {
  const [report, setReport] = useState<AttainmentReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/sales/attainment')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        return data.report as AttainmentReport;
      })
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Sales Performance"
        description="Quotas, pipeline, attainment, and commission estimates for revenue roles."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/dashboard/sales/targets', label: 'Targets & quotas', icon: Target },
          { href: '/dashboard/sales/deals', label: 'Pipeline', icon: Handshake },
          { href: '/dashboard/sales/attainment', label: 'Attainment', icon: TrendingUp },
          { href: '/dashboard/sales/commissions', label: 'Commissions', icon: Coins },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${DASHBOARD_STAT_CARD_CLASS} block p-5 transition hover:border-[var(--stride-coral)] hover:shadow-md`}
          >
            <Icon className="h-5 w-5 text-[var(--stride-coral)]" />
            <p className="mt-3 font-semibold text-[var(--dash-text-strong)]">{label}</p>
          </Link>
        ))}
      </div>

      <div className={`mt-8 ${DASHBOARD_STAT_CARD_CLASS} p-6`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">This period</h2>
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-[var(--dash-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading attainment…
          </div>
        ) : report ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[var(--dash-text-muted)]">Team target</p>
              <p className="text-2xl font-semibold text-[var(--dash-text-strong)]">
                {report.teamTotals.target.toLocaleString('en-KE')} {report.currency}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--dash-text-muted)]">Closed revenue</p>
              <p className="text-2xl font-semibold text-[var(--dash-text-strong)]">
                {report.teamTotals.actual.toLocaleString('en-KE')} {report.currency}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--dash-text-muted)]">Attainment</p>
              <p className="text-2xl font-semibold text-[var(--stride-coral)]">
                {report.teamTotals.attainmentPct != null ? `${report.teamTotals.attainmentPct}%` : '—'}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">No attainment data for this period yet.</p>
        )}
      </div>
    </DashboardPage>
  );
}
