'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Coins,
  Handshake,
  Loader2,
  Target,
  TrendingUp,
  Plus,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_STAT_CARD_CLASS, DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';

type SalesOverview = {
  periodStart: string;
  periodEnd: string;
  currency: string;
  teamTarget: number;
  closedRevenue: number;
  attainmentPct: number | null;
  weightedPipeline: number;
  coverage: number | null;
  dealsClosingThisPeriod: number;
  funnel: Array<{ stage: string; count: number; value: number }>;
  weekMovements: Array<{ fromStage: string | null; toStage: string; count: number }>;
};

function formatKes(n: number, currency = 'KES') {
  return `${Math.round(n).toLocaleString('en-KE')} ${currency}`;
}

const STAGE_LABEL: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export default function SalesOverviewContent() {
  const [report, setReport] = useState<SalesOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/sales/overview')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        return data.overview as SalesOverview;
      })
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const empty =
    !loading &&
    report &&
    report.teamTarget === 0 &&
    report.closedRevenue === 0 &&
    report.weightedPipeline === 0 &&
    report.funnel.every((f) => f.count === 0);

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Sales Performance"
        description="Quotas, pipeline, attainment, and commission estimates for revenue roles."
        icon={TrendingUp}
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

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-[var(--dash-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading sales KPIs…
        </div>
      ) : empty ? (
        <div className={`mt-8 ${DASHBOARD_SURFACE_CLASS} px-6 py-12 text-center`}>
          <p className="text-lg font-semibold text-[var(--dash-text-strong)]">No pipeline yet</p>
          <p className="mt-2 text-sm text-[var(--dash-text-muted)]">
            Add your first deal to populate targets, coverage, and attainment.
          </p>
          <Link
            href="/dashboard/sales/deals"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Open pipeline
          </Link>
        </div>
      ) : report ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Team target', value: formatKes(report.teamTarget, report.currency) },
              {
                label: 'Closed revenue',
                value: formatKes(report.closedRevenue, report.currency),
              },
              {
                label: 'Attainment',
                value:
                  report.attainmentPct != null ? `${report.attainmentPct}%` : '—',
                accent: true,
              },
              {
                label: 'Weighted pipeline',
                value: formatKes(report.weightedPipeline, report.currency),
              },
              {
                label: 'Pipeline coverage',
                value: report.coverage != null ? `${report.coverage}×` : '—',
              },
              {
                label: 'Deals closing this period',
                value: String(report.dealsClosingThisPeriod),
              },
            ].map((kpi) => (
              <div key={kpi.label} className={`${DASHBOARD_STAT_CARD_CLASS} p-5`}>
                <p className="text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
                  {kpi.label}
                </p>
                <p
                  className={`mt-2 text-2xl font-semibold ${
                    kpi.accent ? 'text-[var(--stride-coral)]' : 'text-[var(--dash-text-strong)]'
                  }`}
                >
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className={`${DASHBOARD_SURFACE_CLASS} p-5`}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                Funnel
              </h2>
              <ul className="mt-4 space-y-3">
                {report.funnel.map((f) => {
                  const max = Math.max(...report.funnel.map((x) => x.value), 1);
                  const pct = Math.round((f.value / max) * 100);
                  return (
                    <li key={f.stage}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span>{STAGE_LABEL[f.stage] ?? f.stage}</span>
                        <span className="text-[var(--dash-text-muted)]">
                          {f.count} · {formatKes(f.value, report.currency)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--dash-surface-muted)]">
                        <div
                          className="h-full rounded-full bg-[var(--stride-coral)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className={`${DASHBOARD_SURFACE_CLASS} p-5`}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                This week&apos;s movement
              </h2>
              {report.weekMovements.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--dash-text-muted)]">
                  No stage changes in the last 7 days.
                </p>
              ) : (
                <ul className="mt-4 space-y-2 text-sm">
                  {report.weekMovements.map((m, i) => (
                    <li
                      key={`${m.fromStage}-${m.toStage}-${i}`}
                      className="flex justify-between border-b border-[var(--dash-border)] py-2"
                    >
                      <span>
                        {m.fromStage ? STAGE_LABEL[m.fromStage] ?? m.fromStage : 'New'} →{' '}
                        {STAGE_LABEL[m.toStage] ?? m.toStage}
                      </span>
                      <span className="font-medium">{m.count}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/dashboard/sales/deals"
                className="mt-4 inline-block text-sm font-medium text-[var(--stride-coral)]"
              >
                Open pipeline →
              </Link>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-8 text-sm text-[var(--dash-text-muted)]">Unable to load sales overview.</p>
      )}
    </DashboardPage>
  );
}
