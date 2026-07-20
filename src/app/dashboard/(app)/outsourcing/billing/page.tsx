'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Receipt, RefreshCw } from 'lucide-react';
import {
  DashboardAsyncState,
  DashboardPageSkeleton,
} from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';
import { OutsourcingClientSwitcher } from '@/components/outsourcing/OutsourcingClientSwitcher';
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';
import { StrideSelect } from '@/components/ui/stride-select';

type InvoiceRow = {
  id: string;
  invoiceNumber: number;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  status: string;
  subtotal: number;
  accountsClientId: string;
  outsourcingClientId: string | null;
  outsourcingClientName: string;
};

function OutsourcingBillingContent() {
  const { clientId, clients, setClientId, showSwitcher } = useOutsourcingClient();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [mode, setMode] = useState<'monthly' | 'payroll'>('monthly');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/outsourcing/billing');
      const json = (await res.json()) as { invoices?: InvoiceRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to load billing.');
      const rows = json.invoices ?? [];
      setInvoices(
        clientId ? rows.filter((row) => row.outsourcingClientId === clientId) : rows,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing.');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    if (!clientId) {
      setError('Select an end-client before generating an invoice.');
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/outsourcing/billing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outsourcingClientId: clientId,
          month: Number(month),
          year: Number(year),
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate invoice.');
      setMessage(`Created invoice #${data.invoiceNumber}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate invoice.');
    } finally {
      setBusy(false);
    }
  }

  const status = loading ? 'loading' : error && invoices.length === 0 ? 'error' : invoices.length === 0 ? 'empty' : 'success';

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="09 — HR Outsourcing"
        icon={Receipt}
        title="Client billing"
        description="Generate and track invoices for end-clients from active rate cards."
        actions={
          <button type="button" onClick={() => void load()} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {showSwitcher ? (
        <div className="mb-4 overflow-hidden dashboard-surface shadow-sm">
          <DashboardTableToolbar>
            <OutsourcingClientSwitcher
              clients={clients}
              value={clientId}
              onChange={setClientId}
              className={dashboardFilterSelectClass}
            />
          </DashboardTableToolbar>
        </div>
      ) : null}

      <div className="mb-4 dashboard-surface shadow-sm p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-primary-900 mb-3">Generate invoice</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">Month</span>
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={dashboardFilterSelectClass}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">Year</span>
            <input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={dashboardFilterSelectClass}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">Mode</span>
            <StrideSelect
              value={mode}
              onChange={(value) => setMode(value as 'monthly' | 'payroll')}
              ariaLabel="Mode"
              options={[
                { value: 'monthly', label: 'Monthly (rate card)' },
                { value: 'payroll', label: 'Payroll pass-through' },
              ]}
            />
          </label>
          <button
            type="button"
            disabled={busy || !clientId}
            onClick={() => void generate()}
            className="btn-primary h-10 px-4 disabled:opacity-60"
          >
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </div>

      <DashboardTableCard>
        <DashboardAsyncState
          status={status}
          error={error}
          onRetry={() => void load()}
          loading={<DashboardPageSkeleton variant="list" />}
          empty={
            <DashboardTableEmpty
              icon={<Receipt className="h-8 w-8 text-neutral-300" aria-hidden />}
              title="No outsourcing invoices yet"
              description="Generate a monthly or payroll invoice for an end-client with an active rate card."
            />
          }
        >
          <DashboardTableViewport minWidth={720}>
            <DashboardTable>
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">End-client</th>
                  <th className="px-3 py-2">Issue date</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 col-right">Amount</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-3 py-2 tabular-nums">#{inv.invoiceNumber}</td>
                    <td className="px-3 py-2">
                      {inv.outsourcingClientId ? (
                        <Link
                          href={`/dashboard/outsourcing/clients/${inv.outsourcingClientId}`}
                          className="font-medium text-primary-700 hover:underline"
                        >
                          {inv.outsourcingClientName}
                        </Link>
                      ) : (
                        inv.outsourcingClientName
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{inv.issueDate}</td>
                    <td className="px-3 py-2 capitalize">{inv.status}</td>
                    <td className="px-3 py-2 col-right tabular-nums">
                      {inv.currency} {inv.subtotal.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/accounts/invoices/${inv.id}`}
                        className="text-sm font-medium text-primary-700 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
          </DashboardTableViewport>
        </DashboardAsyncState>
      </DashboardTableCard>
    </DashboardPage>
  );
}

export default function OutsourcingBillingPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500">Loading billing…</div>}>
      <OutsourcingBillingContent />
    </Suspense>
  );
}
