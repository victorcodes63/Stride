'use client';

import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Loader2, TrendingUp } from 'lucide-react';

interface MonthTrend {
  month: number;
  headcount: number;
  gross: number;
  net: number;
  paye: number;
  nssf: number;
  nhif: number;
  ahl: number;
  nita: number;
  deductions: number;
}

interface TrendsResponse {
  year: number;
  months: MonthTrend[];
  ytd: {
    gross: number;
    net: number;
    paye: number;
    nssf: number;
    nhif: number;
    ahl: number;
    nita: number;
    deductions: number;
    avgHeadcount: number;
  };
}

interface PayrollTrendsProps {
  clientId?: string;
  year: number;
  apiBase?: string;
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const currencyFormatter = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function SummaryTile({
  label,
  value,
  tone = 'primary',
}: {
  label: string;
  value: string;
  tone?: 'primary' | 'emerald' | 'neutral';
}) {
  const valueTone =
    tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'neutral'
        ? 'text-neutral-800'
        : 'text-primary-900';
  return (
    <div className="dashboard-surface p-4 sm:p-5 shadow-sm min-w-0">
      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
        {label}
      </p>
      <p className={`text-lg sm:text-2xl font-bold tabular-nums ${valueTone}`}>{value}</p>
    </div>
  );
}

/** Lightweight inline bar sparkline of monthly gross (no chart dependency). */
function Sparkline({ months }: { months: MonthTrend[] }) {
  const max = Math.max(1, ...months.map((m) => m.gross));
  return (
    <div className="flex items-end gap-1 h-16" aria-hidden="true">
      {months.map((m) => {
        const pct = Math.round((m.gross / max) * 100);
        return (
          <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full">
            <div
              className={`w-full rounded-t ${m.gross > 0 ? 'bg-primary-500/80' : 'bg-neutral-200'}`}
              style={{ height: `${Math.max(pct, m.gross > 0 ? 4 : 2)}%` }}
              title={`${MONTH_LABELS[m.month - 1]}: ${formatCurrency(m.gross)}`}
            />
            <span className="mt-1 text-[9px] text-neutral-400">{MONTH_LABELS[m.month - 1]}</span>
          </div>
        );
      })}
    </div>
  );
}

function GrossChange({ current, previous }: { current: number; previous: number | null }) {
  if (previous == null || previous === 0) {
    return <span className="text-neutral-300">—</span>;
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.05) {
    return <span className="text-neutral-400 tabular-nums">0.0%</span>;
  }
  const up = pct > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 tabular-nums font-medium ${
        up ? 'text-emerald-600' : 'text-red-600'
      }`}
    >
      {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function PayrollTrends({
  clientId,
  year,
  apiBase = '/api/outsourcing/payroll',
}: PayrollTrendsProps) {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('year', String(year));
        if (clientId && clientId.trim()) params.set('clientId', clientId.trim());
        const res = await fetch(`${apiBase}/trends?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load payroll trends');
        if (!cancelled) setData(json as TrendsResponse);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load payroll trends');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, year, apiBase]);

  if (loading) {
    return (
      <div className="dashboard-surface shadow-sm p-6 flex items-center gap-3 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payroll trends…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { months, ytd } = data;
  const totalStatutoryYtd = ytd.paye + ytd.nssf + ytd.nhif + ytd.ahl + ytd.nita;
  const monthsWithData = months.filter((m) => m.headcount > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryTile label={`Gross YTD (${data.year})`} value={formatCurrency(ytd.gross)} />
        <SummaryTile label="Net YTD" value={formatCurrency(ytd.net)} tone="emerald" />
        <SummaryTile label="PAYE YTD" value={formatCurrency(ytd.paye)} tone="neutral" />
        <SummaryTile label="Total statutory YTD" value={formatCurrency(totalStatutoryYtd)} tone="neutral" />
      </div>

      <div className="dashboard-surface shadow-sm p-4 sm:p-6">
        <h3 className="text-base font-semibold text-primary-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          Monthly gross ({data.year})
        </h3>
        <Sparkline months={months} />
      </div>

      <div className="dashboard-surface shadow-sm p-4 sm:p-6">
        <h3 className="text-base font-semibold text-primary-900 mb-4">
          Month-over-month
        </h3>
        {monthsWithData.length === 0 ? (
          <p className="text-sm text-neutral-600">No payroll records for {data.year} yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500 whitespace-nowrap">
                  <th className="py-2 pr-3">Month</th>
                  <th className="py-2 px-3 text-right">Headcount</th>
                  <th className="py-2 px-3 text-right">Gross</th>
                  <th className="py-2 px-3 text-right">Net</th>
                  <th className="py-2 px-3 text-right">PAYE</th>
                  <th className="py-2 px-3 text-right">Deductions</th>
                  <th className="py-2 pl-3 text-right">Gross Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {months.map((m, i) => {
                  if (m.headcount === 0) return null;
                  const prev = i > 0 ? months[i - 1] : null;
                  const prevGross = prev && prev.headcount > 0 ? prev.gross : null;
                  return (
                    <tr key={m.month} className="text-neutral-700 whitespace-nowrap">
                      <td className="py-2.5 pr-3 font-medium text-primary-900">
                        {MONTH_LABELS[m.month - 1]}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{m.headcount}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{formatCurrency(m.gross)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{formatCurrency(m.net)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{formatCurrency(m.paye)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-neutral-600">
                        {formatCurrency(m.deductions)}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <GrossChange current={m.gross} previous={prevGross} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
