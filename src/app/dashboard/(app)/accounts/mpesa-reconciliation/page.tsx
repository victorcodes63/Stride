'use client';

import { useCallback, useEffect, useState } from 'react';
import { Smartphone, Loader2, AlertTriangle, RefreshCw, CheckCircle2, Link2, Wallet } from 'lucide-react';
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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [data, setData] = useState<ReconData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/mpesa-reconciliation?month=${month}&year=${year}`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load reconciliation');
      setData(json as ReconData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const periodLabel = `${MONTHS[month - 1]} ${year}`;

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Smartphone}
        title="M-Pesa reconciliation"
        description="Match payroll disbursement references with client M-Pesa receipts for the selected period."
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
              min={2020}
              max={2100}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
              className="dash-auth-input w-28 rounded-lg px-3 py-2 text-sm"
              aria-label="Year"
            />
            <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary inline-flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
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

      {loading ? (
        <div className="dashboard-panel flex items-center gap-2 p-8 text-sm text-[var(--dash-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading reconciliation for {periodLabel}…
        </div>
      ) : data ? (
        <>
          <DashboardStatGrid columns={4} className="mb-6 gap-3 sm:gap-4">
            <DashboardMetricCard
              label="Disbursements"
              value={data.summary.disbursementCount}
              hint="Payroll M-Pesa lines"
              icon={Wallet}
              tone="primary"
            />
            <DashboardMetricCard
              label="M-Pesa receipts"
              value={data.summary.receiptCount}
              hint="Client payments"
              icon={Smartphone}
              tone="violet"
            />
            <DashboardMetricCard
              label="Matched refs"
              value={data.summary.matchedPairs}
              hint="Reference pairs linked"
              icon={CheckCircle2}
              tone="emerald"
            />
            <DashboardMetricCard
              label="Unreconciled"
              value={data.summary.unreconciledDisbursements}
              hint="Outflows without receipt match"
              icon={Link2}
              tone={data.summary.unreconciledDisbursements > 0 ? 'amber' : 'primary'}
            />
          </DashboardStatGrid>

          <div className="grid gap-6 lg:grid-cols-2">
            <DashboardTableCard>
              <DashboardTableMeta
                title="Payroll disbursements"
                description={`${data.disbursements.length} line${data.disbursements.length === 1 ? '' : 's'} in ${periodLabel}`}
              />
              {data.disbursements.length === 0 ? (
                <DashboardTableEmpty title="No disbursements" description="No M-Pesa payroll lines for this period." />
              ) : (
                <DashboardTableViewport minWidth={520}>
                  <DashboardTable>
                    <thead>
                      <tr>
                        <DashboardTableHead>Employee</DashboardTableHead>
                        <DashboardTableHead>Ref</DashboardTableHead>
                        <DashboardTableHead className="text-right">Amount</DashboardTableHead>
                        <DashboardTableHead>Match</DashboardTableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {data.disbursements.map((d) => (
                        <tr key={d.lineId}>
                          <DashboardTableCell>{d.employeeName}</DashboardTableCell>
                          <DashboardTableCell>
                            <span className="font-mono text-xs">{d.providerRef ?? '—'}</span>
                          </DashboardTableCell>
                          <DashboardTableCell numeric className="text-right">
                            {fmt(d.amount)}
                          </DashboardTableCell>
                          <DashboardTableCell>
                            {d.reconciled ? (
                              <span className="text-[var(--dash-success-fg)]">Matched</span>
                            ) : (
                              <span className="text-[var(--dash-text-muted)]">—</span>
                            )}
                          </DashboardTableCell>
                        </tr>
                      ))}
                    </tbody>
                  </DashboardTable>
                </DashboardTableViewport>
              )}
            </DashboardTableCard>

            <DashboardTableCard>
              <DashboardTableMeta
                title="Client receipts"
                description={`${data.receipts.length} M-Pesa receipt${data.receipts.length === 1 ? '' : 's'}`}
              />
              {data.receipts.length === 0 ? (
                <DashboardTableEmpty title="No receipts" description="No client M-Pesa payments recorded this period." />
              ) : (
                <DashboardTableViewport minWidth={520}>
                  <DashboardTable>
                    <thead>
                      <tr>
                        <DashboardTableHead>Client</DashboardTableHead>
                        <DashboardTableHead>Ref</DashboardTableHead>
                        <DashboardTableHead className="text-right">Amount</DashboardTableHead>
                        <DashboardTableHead className="text-right">Unalloc.</DashboardTableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {data.receipts.map((r) => (
                        <tr key={r.paymentId}>
                          <DashboardTableCell>{r.clientName}</DashboardTableCell>
                          <DashboardTableCell>
                            <span className="font-mono text-xs">{r.reference ?? '—'}</span>
                          </DashboardTableCell>
                          <DashboardTableCell numeric className="text-right">
                            {fmt(r.amount)}
                          </DashboardTableCell>
                          <DashboardTableCell numeric className="text-right">
                            {fmt(r.unmatchedBalance)}
                          </DashboardTableCell>
                        </tr>
                      ))}
                    </tbody>
                  </DashboardTable>
                </DashboardTableViewport>
              )}
            </DashboardTableCard>
          </div>
        </>
      ) : null}
    </DashboardPage>
  );
}
