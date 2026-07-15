'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Loader2, PieChart } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_STAT_CARD_CLASS, DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';

type PeriodType = 'month' | 'quarter' | 'year';

type ForecastDeal = {
  id: string;
  name: string;
  stage: string;
  value: number;
  probability: number;
  forecastCategory: string;
  expectedCloseDate: string | null;
};

type Snapshot = {
  id: string;
  takenAt: string;
  commitAmount: number;
  bestCaseAmount: number;
  pipelineAmount: number;
  closedAmount: number;
  teamTarget: number;
  notes: string | null;
};

type ForecastData = {
  rollup: {
    commitAmount: number;
    bestCaseAmount: number;
    pipelineAmount: number;
    closedAmount: number;
  };
  teamTarget: number;
  currency: string;
  deals: ForecastDeal[];
  snapshots: Snapshot[];
  periodStart: string;
  periodEnd: string;
};

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

const CATEGORY_LABELS: Record<string, string> = {
  commit: 'Commit',
  best_case: 'Best case',
  pipeline: 'Pipeline',
  omitted: 'Omitted',
};

const WATERFALL_COLORS = [
  'bg-[var(--stride-coral)]',
  'bg-amber-500',
  'bg-sky-500',
  'bg-emerald-500',
];

function formatKes(n: number, currency = 'KES') {
  return `${n.toLocaleString('en-KE')} ${currency}`;
}

function formatDelta(n: number, currency = 'KES') {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('en-KE')} ${currency}`;
}

export default function SalesForecastContent() {
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/sales/forecast?periodType=${periodType}`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(json.error || 'Failed to load');
        return json as ForecastData;
      })
      .then(setData)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [periodType]);

  useEffect(() => {
    load();
  }, [load]);

  const waterfall = useMemo(() => {
    if (!data) return null;
    const bars = [
      { key: 'commit', label: 'Commit', value: data.rollup.commitAmount },
      { key: 'best', label: 'Best case', value: data.rollup.bestCaseAmount },
      { key: 'pipeline', label: 'Pipeline', value: data.rollup.pipelineAmount },
      { key: 'closed', label: 'Closed', value: data.rollup.closedAmount },
    ];
    const max = Math.max(...bars.map((b) => b.value), 1);
    const latest = data.snapshots[0] ?? null;
    const previous = data.snapshots[1] ?? null;
    const deltas =
      latest && previous
        ? [
            {
              label: 'Commit',
              delta: latest.commitAmount - previous.commitAmount,
            },
            {
              label: 'Best case',
              delta: latest.bestCaseAmount - previous.bestCaseAmount,
            },
            {
              label: 'Pipeline',
              delta: latest.pipelineAmount - previous.pipelineAmount,
            },
            {
              label: 'Closed',
              delta: latest.closedAmount - previous.closedAmount,
            },
          ]
        : null;
    return { bars, max, deltas };
  }, [data]);

  async function saveSnapshot() {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/sales/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'snapshot',
          periodType,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
        }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || 'Failed to save snapshot');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save snapshot');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Forecast"
        description="Commit, best case, and pipeline rollup for the selected period."
        icon={PieChart}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-[var(--dash-border)] p-0.5">
              {PERIOD_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriodType(value)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                    periodType === value
                      ? 'bg-[var(--stride-coral)] text-white'
                      : 'text-[var(--dash-text-muted)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={saving || !data}
              onClick={() => void saveSnapshot()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              Save snapshot
            </button>
          </div>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--dash-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading forecast…
        </div>
      ) : !data ? (
        <div className={`${DASHBOARD_SURFACE_CLASS} px-6 py-12 text-center`}>
          <PieChart className="mx-auto h-8 w-8 text-[var(--stride-coral)]" />
          <p className="mt-3 font-semibold text-[var(--dash-text-strong)]">No forecast data</p>
          <p className="mt-1 text-sm text-[var(--dash-text-muted)]">
            Add deals with expected close dates in this period to populate the rollup.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-xs text-[var(--dash-text-muted)]">
            {data.periodStart} → {data.periodEnd}
          </p>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Commit', value: formatKes(data.rollup.commitAmount, data.currency) },
              {
                label: 'Best case',
                value: formatKes(data.rollup.bestCaseAmount, data.currency),
              },
              {
                label: 'Pipeline',
                value: formatKes(data.rollup.pipelineAmount, data.currency),
              },
              {
                label: 'Closed',
                value: formatKes(data.rollup.closedAmount, data.currency),
                accent: true,
              },
              {
                label: 'Team target',
                value: formatKes(data.teamTarget, data.currency),
              },
            ].map(({ label, value, accent }) => (
              <div key={label} className={DASHBOARD_STAT_CARD_CLASS}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                  {label}
                </p>
                <p
                  className={`mt-2 text-xl font-semibold ${
                    accent ? 'text-[var(--stride-coral)]' : 'text-[var(--dash-text-strong)]'
                  }`}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {waterfall ? (
            <div className={`mb-6 overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
              <div className="border-b border-[var(--dash-border)] px-4 py-3">
                <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Waterfall</h2>
                <p className="mt-0.5 text-xs text-[var(--dash-text-muted)]">
                  Commit → Best case → Pipeline → Closed
                </p>
              </div>
              <div className="space-y-3 px-4 py-4">
                {waterfall.bars.map((bar, i) => (
                  <div key={bar.key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--dash-text-strong)]">{bar.label}</span>
                      <span className="text-[var(--dash-text-muted)]">
                        {formatKes(bar.value, data.currency)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[var(--dash-surface-muted)]">
                      <div
                        className={`h-full rounded-full ${WATERFALL_COLORS[i]}`}
                        style={{ width: `${(bar.value / waterfall.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {waterfall.deltas ? (
                  <div className="mt-2 grid gap-2 border-t border-[var(--dash-border)] pt-3 sm:grid-cols-2 lg:grid-cols-4">
                    {waterfall.deltas.map((d) => (
                      <div key={d.label} className="text-xs">
                        <p className="text-[var(--dash-text-muted)]">{d.label} vs prior</p>
                        <p
                          className={`mt-0.5 font-medium ${
                            d.delta > 0
                              ? 'text-emerald-600'
                              : d.delta < 0
                                ? 'text-red-600'
                                : 'text-[var(--dash-text-strong)]'
                          }`}
                        >
                          {formatDelta(d.delta, data.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--dash-text-muted)]">
                    Save at least two snapshots to see deltas vs the previous period snapshot.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <div className={`mb-6 overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
            <div className="border-b border-[var(--dash-border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">
                Deals by category
              </h2>
            </div>
            {data.deals.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--dash-text-muted)]">
                No deals in this period.
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Deal</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Prob.</th>
                    <th className="px-4 py-3">Close</th>
                  </tr>
                </thead>
                <tbody>
                  {data.deals.map((d) => (
                    <tr key={d.id} className="border-t border-[var(--dash-border)]">
                      <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">
                        {d.name}
                      </td>
                      <td className="px-4 py-3">
                        {CATEGORY_LABELS[d.forecastCategory] ?? d.forecastCategory}
                      </td>
                      <td className="px-4 py-3 capitalize">{d.stage}</td>
                      <td className="px-4 py-3">{formatKes(d.value, data.currency)}</td>
                      <td className="px-4 py-3">{d.probability}%</td>
                      <td className="px-4 py-3">{d.expectedCloseDate ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
            <div className="border-b border-[var(--dash-border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">
                Snapshot history
              </h2>
            </div>
            {data.snapshots.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--dash-text-muted)]">
                No snapshots yet. Save one to track forecast changes over time.
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Taken</th>
                    <th className="px-4 py-3">Commit</th>
                    <th className="px-4 py-3">Best case</th>
                    <th className="px-4 py-3">Pipeline</th>
                    <th className="px-4 py-3">Closed</th>
                    <th className="px-4 py-3">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {data.snapshots.map((s) => (
                    <tr key={s.id} className="border-t border-[var(--dash-border)]">
                      <td className="px-4 py-3 text-[var(--dash-text-muted)]">
                        {new Date(s.takenAt).toLocaleString('en-KE')}
                      </td>
                      <td className="px-4 py-3">{formatKes(s.commitAmount, data.currency)}</td>
                      <td className="px-4 py-3">
                        {formatKes(s.bestCaseAmount, data.currency)}
                      </td>
                      <td className="px-4 py-3">
                        {formatKes(s.pipelineAmount, data.currency)}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--stride-coral)]">
                        {formatKes(s.closedAmount, data.currency)}
                      </td>
                      <td className="px-4 py-3">{formatKes(s.teamTarget, data.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </DashboardPage>
  );
}
