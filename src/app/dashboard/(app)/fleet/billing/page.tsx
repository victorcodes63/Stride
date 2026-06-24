'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';

type BillingRow = {
  id: string;
  tripNumber: string;
  status: string;
  origin: string;
  destination: string;
  customerName: string;
  hasPod: boolean;
  estimatedFreightExVat: number;
  actualDeliveryAt: string | null;
};

export default function FleetBillingPage() {
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);
  const [lastInvoice, setLastInvoice] = useState<{ tripNumber: string; invoiceNumber: number } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fleet/billing/queue');
      if (!res.ok) throw new Error('Unable to load billing queue.');
      setRows((await res.json()) as BillingRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load billing queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createInvoice(tripId: string, tripNumber: string) {
    setInvoicingId(tripId);
    setError(null);
    try {
      const res = await fetch(`/api/fleet/trips/${tripId}/client-invoice`, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Unable to create invoice.');
      }
      const data = (await res.json()) as { invoice: { invoiceNumber: number } };
      setLastInvoice({ tripNumber, invoiceNumber: data.invoice.invoiceNumber });
      setRows((prev) => prev.filter((r) => r.id !== tripId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create invoice.');
    } finally {
      setInvoicingId(null);
    }
  }

  const listStatus = loading ? 'loading' : error ? 'error' : 'success';

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Client billing"
        description="Invoice completed trips through the linked accounts billing profile."
        actions={
          <Link
            href="/dashboard/accounts/invoices"
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            Open accounts invoices
          </Link>
        }
      />

      {lastInvoice ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Invoice #{lastInvoice.invoiceNumber} created for trip {lastInvoice.tripNumber}.
        </div>
      ) : null}

      <DashboardAsyncState status={listStatus} error={error} onRetry={() => void load()}>
        <DashboardTableCard>
          <DashboardTableViewport>
            {rows.length === 0 ? (
              <DashboardTableEmpty
                title="Billing queue empty"
                description="Delivered trips without a client invoice appear here."
              />
            ) : (
              <DashboardTable>
                <thead>
                  <tr>
                    <th>Trip</th>
                    <th>Customer</th>
                    <th>POD</th>
                    <th className="col-right">Est. freight (ex VAT)</th>
                    <th className="col-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="col-primary font-medium">
                        {row.tripNumber}
                        <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                          {row.origin} → {row.destination}
                        </span>
                      </td>
                      <td>{row.customerName}</td>
                      <td>{row.hasPod ? 'Verified' : 'Missing'}</td>
                      <td className="col-right">KES {row.estimatedFreightExVat.toLocaleString()}</td>
                      <td className="col-right">
                        <button
                          type="button"
                          disabled={invoicingId === row.id}
                          onClick={() => void createInvoice(row.id, row.tripNumber)}
                          className="text-sm font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                        >
                          {invoicingId === row.id ? 'Creating…' : 'Create invoice'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            )}
          </DashboardTableViewport>
        </DashboardTableCard>
      </DashboardAsyncState>
    </DashboardPage>
  );
}
