'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { ModuleHomeContent } from '@/components/dashboard/module-home/ModuleHomeContent';
import { DashboardPageSection } from '@/components/dashboard/DashboardPage';

type InvoiceRow = {
  id: string;
  invoiceNumber: number;
  clientName: string;
  issueDate: string;
  status: string;
  totalIncVat: number;
  currency: string;
};

export default function AccountsOverviewContent() {
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/accounts/invoices', { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load invoices');
        return data as { invoices?: InvoiceRow[] };
      })
      .then((data) => setInvoices(Array.isArray(data.invoices) ? data.invoices : []))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load invoices');
        setInvoices([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const recentInvoices = useMemo(() => (invoices ?? []).slice(0, 6), [invoices]);

  return (
    <div className="space-y-0">
      <ModuleHomeContent domainId="finance" />

      <DashboardPageSection className="mt-8 border-t border-[var(--dash-border)] pt-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--dash-text-strong)]">Recent invoices</h2>
            <p className="mt-0.5 text-sm text-[var(--dash-text-muted)]">
              Latest billing activity across your clients.
            </p>
          </div>
          <Link
            href="/dashboard/accounts/invoices"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-[var(--stride-coral)] hover:underline"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {error ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
            <button type="button" onClick={load} className="ml-1 font-medium underline">
              Retry
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-[var(--dash-text-muted)]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading invoices…
          </div>
        ) : (
          <div className="dashboard-panel overflow-hidden">
            {recentInvoices.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-[var(--dash-text-muted)]">
                No invoices yet. Create one from a billing client or use the sample seed in development.
              </div>
            ) : (
              <div className="divide-y divide-[var(--dash-border)]">
                {recentInvoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/dashboard/accounts/invoices/${inv.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--dash-hover)]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 shadow-sm ring-2 ring-white">
                      <span className="text-sm font-bold tabular-nums text-primary-800">#{inv.invoiceNumber}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--dash-text-strong)]">{inv.clientName}</p>
                      <p className="truncate text-xs text-[var(--dash-text-muted)]">
                        {inv.issueDate} ·{' '}
                        {inv.totalIncVat.toLocaleString('en-KE', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        {inv.currency}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-[var(--dash-surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                      {inv.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </DashboardPageSection>
    </div>
  );
}
