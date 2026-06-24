'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Download, Loader2, RefreshCw, Smartphone } from 'lucide-react';

import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import useEntityConfig, { useCurrencyFormatter } from '@/hooks/useEntityConfig';

type BatchSummary = {
  id: string;
  month: number;
  year: number;
  status: string;
  providerMode: string;
  providerRef: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  failureSummary: string | null;
  totals: { lines: number; completed: number; failed: number; pending: number };
};

type BatchDetail = BatchSummary & {
  lines?: Array<{
    id: string;
    employeeName: string;
    employeeNumber: string | null;
    amount: number;
    phone: string | null;
    status: string;
    providerRef: string | null;
    failureReason: string | null;
  }>;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-800',
  processing: 'bg-amber-100 text-amber-800',
  submitting: 'bg-amber-100 text-amber-800',
  partial_failure: 'bg-orange-100 text-orange-800',
  failed: 'bg-red-100 text-red-800',
  draft: 'bg-zinc-100 text-zinc-700',
};

function statusClass(status: string) {
  return STATUS_COLORS[status] ?? 'bg-zinc-100 text-zinc-700';
}

export function DisbursementsContent() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selected, setSelected] = useState<BatchDetail | null>(null);
  const [providerMode, setProviderMode] = useState('simulated');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formatCurrency = useCurrencyFormatter();
  useEntityConfig();

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/outsourcing/payroll/disbursements?month=${month}&year=${year}`,
        { credentials: 'include' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load disbursements');
      setBatches(data.batches ?? []);
      setProviderMode(data.providerMode ?? 'simulated');
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  const loadBatchDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/outsourcing/payroll/disbursements/${id}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to load batch');
    setSelected(data.batch);
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/outsourcing/payroll/disbursements', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Disbursement failed');
      setSelected(data.batch);
      await loadBatches();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePoll(batchId: string) {
    setPolling(true);
    setError(null);
    try {
      const res = await fetch(`/api/outsourcing/payroll/disbursements/${batchId}/poll`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Poll failed');
      setSelected(data.batch);
      await loadBatches();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Poll failed');
    } finally {
      setPolling(false);
    }
  }

  const bankExportHref = `/api/outsourcing/payroll/bank-export?month=${month}&year=${year}`;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="M-Pesa & disbursements"
        description="Bulk salary disbursement via M-Pesa sandbox with per-employee payment status. Bank CSV export remains available for RTGS runs."
      />

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="text-sm">
          <span className="text-zinc-500">Month</span>
          <select
            className="mt-1 block rounded-lg border border-zinc-200 px-3 py-2"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
          >
            {MONTHS.map((label, i) => (
              <option key={label} value={i + 1}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-zinc-500">Year</span>
          <input
            type="number"
            className="mt-1 block w-28 rounded-lg border border-zinc-200 px-3 py-2"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
          />
        </label>
        <button
          type="button"
          onClick={() => void loadBatches()}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
        <a
          href={bankExportHref}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          <Download className="h-4 w-4" />
          Bank CSV export
        </a>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
          Disburse via M-Pesa (sandbox)
        </button>
      </div>

      <p className="mb-4 text-sm text-zinc-600">
        Provider mode: <span className="font-mono text-xs">{providerMode}</span>
        {providerMode === 'simulated' ? (
          <> — poll twice to simulate M-Pesa processing → completed.</>
        ) : null}
        {' '}
        <Link href="/dashboard/payroll" className="text-blue-600 hover:underline">Payroll runs</Link>
      </p>

      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Batches this period</h2>
          {batches.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No M-Pesa batches yet for {MONTHS[month - 1]} {year}.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100">
              {batches.map((batch) => (
                <li key={batch.id} className="flex items-center justify-between gap-3 py-3">
                  <button
                    type="button"
                    className="text-left text-sm hover:underline"
                    onClick={() => void loadBatchDetail(batch.id)}
                  >
                    <span className={`inline rounded px-2 py-0.5 text-xs font-medium ${statusClass(batch.status)}`}>
                      {batch.status}
                    </span>
                    <span className="ml-2 text-zinc-600">
                      {batch.totals.completed}/{batch.totals.lines} paid
                    </span>
                  </button>
                  {['processing', 'submitting', 'partial_failure'].includes(batch.status) ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-blue-600 hover:underline"
                      disabled={polling}
                      onClick={() => void handlePoll(batch.id)}
                    >
                      Poll status
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Employee payments</h2>
          {!selected ? (
            <p className="mt-3 text-sm text-zinc-500">Select a batch or submit a new disbursement.</p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(selected.status)}`}>
                  {selected.status}
                </span>
                {selected.failureSummary ? (
                  <span className="text-orange-700">{selected.failureSummary}</span>
                ) : null}
                {['processing', 'submitting', 'partial_failure'].includes(selected.status) ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-600 hover:underline"
                    disabled={polling}
                    onClick={() => void handlePoll(selected.id)}
                  >
                    {polling ? 'Polling…' : 'Poll M-Pesa status'}
                  </button>
                ) : null}
              </div>
              <div className="mt-4 max-h-[28rem] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-zinc-500">
                      <th className="py-2 pr-2">Employee</th>
                      <th className="py-2 pr-2">Phone</th>
                      <th className="py-2 pr-2 text-right">Net</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.lines ?? []).map((line) => (
                      <tr key={line.id} className="border-b border-zinc-50">
                        <td className="py-2 pr-2">
                          <div className="font-medium">{line.employeeName}</div>
                          {line.employeeNumber ? (
                            <div className="text-xs text-zinc-500">{line.employeeNumber}</div>
                          ) : null}
                        </td>
                        <td className="py-2 pr-2 font-mono text-xs">{line.phone ?? '—'}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(line.amount)}</td>
                        <td className="py-2">
                          <span className={`rounded px-1.5 py-0.5 text-xs ${statusClass(line.status)}`}>
                            {line.status}
                          </span>
                          {line.failureReason ? (
                            <div className="text-xs text-red-600">{line.failureReason}</div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </DashboardPage>
  );
}
