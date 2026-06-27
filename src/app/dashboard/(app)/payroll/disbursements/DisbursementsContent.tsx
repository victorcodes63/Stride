'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react';

import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardMetricCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableCell,
  DashboardTableEmpty,
  DashboardTableHead,
  DashboardTableMeta,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
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

function statusClass(status: string) {
  switch (status) {
    case 'completed':
      return dashStatusChip('success');
    case 'processing':
    case 'submitting':
      return dashStatusChip('warning');
    case 'partial_failure':
      return dashStatusChip('warning');
    case 'failed':
      return dashStatusChip('danger');
    default:
      return dashStatusChip('neutral');
  }
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
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

  const summary = useMemo(() => {
    const totals = batches.reduce(
      (acc, batch) => ({
        lines: acc.lines + batch.totals.lines,
        completed: acc.completed + batch.totals.completed,
        failed: acc.failed + batch.totals.failed,
        pending: acc.pending + batch.totals.pending,
      }),
      { lines: 0, completed: 0, failed: 0, pending: 0 },
    );
    const activeBatch = batches.find((b) =>
      ['processing', 'submitting', 'partial_failure'].includes(b.status),
    );
    return { ...totals, batchCount: batches.length, activeBatch };
  }, [batches]);

  const periodLabel = `${MONTHS[month - 1]} ${year}`;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="M-Pesa & disbursements"
        icon={Smartphone}
        description="Bulk salary disbursement via M-Pesa sandbox with per-employee payment status. Bank CSV export remains available for RTGS runs."
        meta={
          <span className="text-[var(--dash-text-subtle)]">
            Provider mode:{' '}
            <span className="font-mono text-xs text-[var(--dash-text-body)]">{providerMode}</span>
            {providerMode === 'simulated' ? (
              <> — poll twice to simulate M-Pesa processing → completed.</>
            ) : null}
            {' · '}
            <Link href="/dashboard/payroll" className="text-primary-600 hover:underline">
              Payroll runs
            </Link>
          </span>
        }
        actions={
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="dash-auth-input rounded-lg px-3 py-2 text-sm"
              aria-label="Month"
            >
              {MONTHS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
              className="dash-auth-input w-28 rounded-lg px-3 py-2 text-sm"
              min={2020}
              max={2100}
              aria-label="Year"
            />
            <button
              type="button"
              onClick={() => void loadBatches()}
              disabled={loading}
              className="btn-secondary inline-flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
            <a href={bankExportHref} className="btn-secondary inline-flex items-center gap-2">
              <Download className="h-4 w-4" />
              Bank CSV
            </a>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              Disburse via M-Pesa
            </button>
          </div>
        }
      />

      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--dash-danger-border)] bg-[var(--dash-danger-bg)] p-3 text-sm text-[var(--dash-danger-fg)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}

      <DashboardStatGrid columns={4} className="mb-6 gap-3 sm:gap-4">
        <DashboardMetricCard
          label="Batches"
          value={summary.batchCount}
          hint={`${periodLabel} period`}
          icon={Wallet}
          tone="primary"
        />
        <DashboardMetricCard
          label="Paid"
          value={summary.completed}
          hint={summary.lines > 0 ? `${Math.round((summary.completed / summary.lines) * 100)}% of lines` : 'No lines yet'}
          icon={CheckCircle2}
          tone="emerald"
        />
        <DashboardMetricCard
          label="Pending"
          value={summary.pending}
          hint={summary.activeBatch ? `Active batch: ${statusLabel(summary.activeBatch.status)}` : 'No active processing'}
          icon={Clock}
          tone="amber"
        />
        <DashboardMetricCard
          label="Failed"
          value={summary.failed}
          hint={summary.failed > 0 ? 'Review lines below' : 'All clear'}
          icon={XCircle}
          tone={summary.failed > 0 ? 'rose' : 'primary'}
        />
      </DashboardStatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardTableCard>
          <DashboardTableMeta
            title="Batches this period"
            description={
              batches.length === 0
                ? `No M-Pesa batches yet for ${periodLabel}.`
                : `${batches.length} batch${batches.length === 1 ? '' : 'es'} · select to view employee lines`
            }
          />
          {loading ? (
            <div className="flex items-center gap-2 p-8 text-sm text-[var(--dash-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading batches…
            </div>
          ) : batches.length === 0 ? (
            <DashboardTableEmpty
              title="No disbursement batches"
              description={`Submit a disbursement for ${periodLabel} to create your first M-Pesa batch.`}
            />
          ) : (
            <ul className="divide-y divide-[var(--dash-border)]">
              {batches.map((batch) => {
                const isSelected = selected?.id === batch.id;
                const needsPoll = ['processing', 'submitting', 'partial_failure'].includes(batch.status);
                return (
                  <li key={batch.id}>
                    <div
                      className={`flex items-center justify-between gap-3 px-4 py-3 sm:px-5 ${
                        isSelected ? 'bg-[var(--dash-surface-muted)]' : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => void loadBatchDetail(batch.id)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(batch.status)}`}>
                            {statusLabel(batch.status)}
                          </span>
                          <span className="text-sm text-[var(--dash-text-body)]">
                            {batch.totals.completed}/{batch.totals.lines} paid
                          </span>
                          {batch.submittedAt ? (
                            <span className="text-xs text-[var(--dash-text-subtle)]">
                              {new Date(batch.submittedAt).toLocaleString()}
                            </span>
                          ) : null}
                        </div>
                        {batch.failureSummary ? (
                          <p className="mt-1 text-xs text-[var(--dash-warning-fg)]">{batch.failureSummary}</p>
                        ) : null}
                      </button>
                      {needsPoll ? (
                        <button
                          type="button"
                          className="shrink-0 text-xs font-medium text-primary-600 hover:underline disabled:opacity-50"
                          disabled={polling}
                          onClick={() => void handlePoll(batch.id)}
                        >
                          {polling ? 'Polling…' : 'Poll status'}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardTableCard>

        <DashboardTableCard>
          <DashboardTableMeta
            title="Employee payments"
            description={
              selected
                ? `Batch ${statusLabel(selected.status)} · ${selected.totals.completed}/${selected.totals.lines} completed`
                : 'Select a batch or submit a new disbursement.'
            }
            actions={
              selected && ['processing', 'submitting', 'partial_failure'].includes(selected.status) ? (
                <button
                  type="button"
                  className="text-xs font-medium text-primary-600 hover:underline disabled:opacity-50"
                  disabled={polling}
                  onClick={() => void handlePoll(selected.id)}
                >
                  {polling ? 'Polling…' : 'Poll M-Pesa status'}
                </button>
              ) : null
            }
          />
          {!selected ? (
            <DashboardTableEmpty
              title="No batch selected"
              description="Choose a batch from the left panel or disburse salaries for this period."
            />
          ) : (selected.lines ?? []).length === 0 ? (
            <DashboardTableEmpty title="No payment lines" description="This batch has no employee lines yet." />
          ) : (
            <DashboardTableViewport minWidth={640}>
              <DashboardTable>
                <thead>
                  <tr>
                    <DashboardTableHead>Employee</DashboardTableHead>
                    <DashboardTableHead>Phone</DashboardTableHead>
                    <DashboardTableHead className="text-right">Net</DashboardTableHead>
                    <DashboardTableHead>Status</DashboardTableHead>
                  </tr>
                </thead>
                <tbody>
                  {(selected.lines ?? []).map((line) => (
                    <tr key={line.id}>
                      <DashboardTableCell>
                        <div className="font-medium text-[var(--dash-text-strong)]">{line.employeeName}</div>
                        {line.employeeNumber ? (
                          <div className="text-xs text-[var(--dash-text-subtle)]">{line.employeeNumber}</div>
                        ) : null}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <span className="font-mono text-xs">{line.phone ?? '—'}</span>
                      </DashboardTableCell>
                      <DashboardTableCell numeric className="text-right">
                        {formatCurrency(line.amount)}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(line.status)}`}>
                          {statusLabel(line.status)}
                        </span>
                        {line.failureReason ? (
                          <div className="mt-1 text-xs text-[var(--dash-danger-fg)]">{line.failureReason}</div>
                        ) : null}
                      </DashboardTableCell>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            </DashboardTableViewport>
          )}
        </DashboardTableCard>
      </div>
    </DashboardPage>
  );
}
