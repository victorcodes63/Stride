'use client';

import { useCallback, useEffect, useState } from 'react';
import { Smartphone, Loader2, AlertCircle } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type ReconData = {
  period: { month: number; year: number };
  summary: {
    disbursementCount: number;
    receiptCount: number;
    matchedPairs: number;
    unreconciledDisbursements: number;
  };
  disbursements: Array<{
    lineId: string;
    employeeName: string;
    amount: number;
    providerRef: string | null;
    status: string;
    reconciled: boolean;
  }>;
  receipts: Array<{
    paymentId: string;
    clientName: string;
    receivedAt: string;
    amount: number;
    reference: string | null;
    unmatchedBalance: number;
    matchedDisbursementLineId: string | null;
  }>;
};

function fmt(n: number) {
  return n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MpesaReconciliationPage() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getUTCMonth() + 1));
  const [year, setYear] = useState(String(now.getUTCFullYear()));
  const [data, setData] = useState<ReconData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/accounts/mpesa-reconciliation?month=${month}&year=${year}`, { cache: 'no-store' })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed');
        return json as ReconData;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Smartphone}
        title="M-Pesa reconciliation"
        description="Match payroll disbursement references with client M-Pesa receipts for the selected period."
      />

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <label className="text-xs">
          <span className="block text-neutral-600 mb-1">Month</span>
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="block text-neutral-600 mb-1">Year</span>
          <input
            type="number"
            min={2020}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button type="button" onClick={load} className="btn-secondary text-sm">
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="dashboard-stat-card">
              <p className="text-[10px] font-semibold uppercase text-neutral-500">Disbursements</p>
              <p className="text-xl font-bold">{data.summary.disbursementCount}</p>
            </div>
            <div className="dashboard-stat-card">
              <p className="text-[10px] font-semibold uppercase text-neutral-500">M-Pesa receipts</p>
              <p className="text-xl font-bold">{data.summary.receiptCount}</p>
            </div>
            <div className="dashboard-stat-card">
              <p className="text-[10px] font-semibold uppercase text-neutral-500">Matched refs</p>
              <p className="text-xl font-bold text-emerald-700">{data.summary.matchedPairs}</p>
            </div>
            <div className="dashboard-stat-card">
              <p className="text-[10px] font-semibold uppercase text-neutral-500">Unreconciled out</p>
              <p className="text-xl font-bold text-amber-700">{data.summary.unreconciledDisbursements}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <section className="dashboard-surface overflow-hidden">
              <h2 className="px-4 py-3 text-sm font-semibold border-b border-neutral-200">Payroll disbursements</h2>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-neutral-600">
                      <th className="px-3 py-2">Employee</th>
                      <th className="px-3 py-2">Ref</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.disbursements.map((d) => (
                      <tr key={d.lineId} className="border-t border-neutral-100">
                        <td className="px-3 py-2">{d.employeeName}</td>
                        <td className="px-3 py-2 font-mono">{d.providerRef ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(d.amount)}</td>
                        <td className="px-3 py-2">{d.reconciled ? '✓' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="dashboard-surface overflow-hidden">
              <h2 className="px-4 py-3 text-sm font-semibold border-b border-neutral-200">Client receipts</h2>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-neutral-600">
                      <th className="px-3 py-2">Client</th>
                      <th className="px-3 py-2">Ref</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-right">Unalloc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.receipts.map((r) => (
                      <tr key={r.paymentId} className="border-t border-neutral-100">
                        <td className="px-3 py-2">{r.clientName}</td>
                        <td className="px-3 py-2 font-mono">{r.reference ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(r.amount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(r.unmatchedBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </DashboardPage>
  );
}
