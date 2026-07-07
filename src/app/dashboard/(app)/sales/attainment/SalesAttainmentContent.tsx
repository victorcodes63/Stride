'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trophy } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_STAT_CARD_CLASS, DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';

type RepRow = {
  employeeName: string;
  departmentName: string | null;
  target: number;
  actual: number;
  attainmentPct: number | null;
  pacingPct: number | null;
  currency: string;
};

type Report = {
  periodStart: string;
  periodEnd: string;
  currency: string;
  teamTotals: { target: number; actual: number; attainmentPct: number | null };
  leaderboard: RepRow[];
};

export default function SalesAttainmentContent() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/sales/attainment')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed');
        return data.report as Report;
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
        title="Attainment & leaderboard"
        description="Real-time quota attainment per rep with team pacing on Stride coral."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !report ? (
        <p className="text-sm text-neutral-500">No attainment data for this period.</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Team target', value: `${report.teamTotals.target.toLocaleString('en-KE')} ${report.currency}` },
              { label: 'Team actual', value: `${report.teamTotals.actual.toLocaleString('en-KE')} ${report.currency}` },
              {
                label: 'Team attainment',
                value: report.teamTotals.attainmentPct != null ? `${report.teamTotals.attainmentPct}%` : '—',
                accent: true,
              },
            ].map(({ label, value, accent }) => (
              <div key={label} className={DASHBOARD_STAT_CARD_CLASS}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">{label}</p>
                <p
                  className={`mt-2 text-2xl font-semibold ${accent ? 'text-[var(--stride-coral)]' : 'text-[var(--dash-text-strong)]'}`}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
              <Trophy className="h-4 w-4 text-[var(--stride-coral)]" />
              <h2 className="text-sm font-semibold text-neutral-900">Leaderboard</h2>
              <span className="text-xs text-neutral-400">
                {report.periodStart} → {report.periodEnd}
              </span>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Rep</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Actual</th>
                  <th className="px-4 py-3">Attainment</th>
                  <th className="px-4 py-3">Pacing</th>
                </tr>
              </thead>
              <tbody>
                {report.leaderboard.map((r, i) => (
                  <tr key={r.employeeName + i} className="border-t border-neutral-100">
                    <td className="px-4 py-3 font-medium text-neutral-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">{r.employeeName}</div>
                      {r.departmentName && (
                        <div className="text-xs text-neutral-400">{r.departmentName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.target.toLocaleString('en-KE')} {r.currency}
                    </td>
                    <td className="px-4 py-3">
                      {r.actual.toLocaleString('en-KE')} {r.currency}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--stride-coral)]">
                      {r.attainmentPct != null ? `${r.attainmentPct}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.pacingPct != null ? `${r.pacingPct}% of pace` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </DashboardPage>
  );
}
