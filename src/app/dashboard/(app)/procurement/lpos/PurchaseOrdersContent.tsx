'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, AlertCircle, Send, Ban, Download, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type OrderRow = {
  id: string;
  lpoNumber: string;
  title: string;
  currency: string;
  totalAmount: number;
  status: string;
  lineCount: number;
  vendor: { id: string; name: string };
  purchaseRequest: { id: string; requestNumber: string } | null;
  vendorBill: { id: string; billRef: string | null; status: string } | null;
  issuedAt: string | null;
  createdAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-neutral-100 text-neutral-700',
  issued: 'bg-blue-50 text-blue-800',
  fulfilled: 'bg-emerald-50 text-emerald-800',
  cancelled: 'bg-neutral-100 text-neutral-500',
};

function fmtMoney(v: number, currency = 'KES') {
  return v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
}

export default function PurchaseOrdersContent() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = filter ? `?status=${filter}` : '';
    fetch(`/api/procurement/purchase-orders${q}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        return data;
      })
      .then((data) => setOrders(data.orders ?? []))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(id: string, action: string) {
    setActing(id);
    try {
      const r = await fetch(`/api/procurement/purchase-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Action failed');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(null);
    }
  }

  async function receiveAll(id: string) {
    setActing(id);
    try {
      const detailRes = await fetch(`/api/procurement/purchase-orders/${id}`);
      const detail = await detailRes.json().catch(() => ({}));
      if (!detailRes.ok) throw new Error(detail.error || 'Failed to load LPO');

      const lines = (detail.order?.lines ?? []).map((line: { id: string; quantity: number }) => ({
        purchaseOrderLineId: line.id,
        quantityReceived: line.quantity,
      }));

      const r = await fetch('/api/procurement/goods-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseOrderId: id,
          receivedAt: new Date().toISOString().slice(0, 10),
          lines,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Receipt failed');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Receipt failed');
    } finally {
      setActing(null);
    }
  }

  async function linkBill(id: string) {
    const vendorBillId = window.prompt('Enter vendor bill ID to link:');
    if (!vendorBillId?.trim()) return;
    setActing(id);
    try {
      const r = await fetch(`/api/procurement/purchase-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link_bill', vendorBillId: vendorBillId.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Link failed');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link failed');
    } finally {
      setActing(null);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Local purchase orders"
        description="LPOs created from approved purchase requests — issue to vendors and link vendor bills."
        icon={FileText}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {['', 'draft', 'issued', 'fulfilled', 'cancelled'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === s ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-neutral-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading LPOs…
        </div>
      ) : !orders?.length ? (
        <p className="py-12 text-center text-neutral-500">
          No purchase orders yet. Approve a purchase request with a vendor assigned to auto-create an LPO.
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((o, i) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium text-neutral-900">{o.lpoNumber}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[o.status] ?? ''}`}>
                      {o.status}
                    </span>
                    {o.purchaseRequest && (
                      <span className="text-xs text-neutral-500">from {o.purchaseRequest.requestNumber}</span>
                    )}
                  </div>
                  <h3 className="mt-1 font-medium text-neutral-900">{o.title}</h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    {o.vendor.name} · {o.lineCount} line{o.lineCount !== 1 ? 's' : ''} ·{' '}
                    <span className="font-medium">{fmtMoney(o.totalAmount, o.currency)}</span>
                  </p>
                  {o.vendorBill && (
                    <p className="mt-1 text-xs text-emerald-700">
                      Linked bill: {o.vendorBill.billRef || o.vendorBill.id} ({o.vendorBill.status})
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/procurement/purchase-orders/${o.id}/pdf`}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </a>
                  {o.status === 'draft' && (
                    <button
                      type="button"
                      disabled={acting === o.id}
                      onClick={() => runAction(o.id, 'issue')}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {acting === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Issue
                    </button>
                  )}
                  {o.status === 'issued' && (
                    <>
                      <button
                        type="button"
                        disabled={acting === o.id}
                        onClick={() => receiveAll(o.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {acting === o.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Package className="h-4 w-4" />
                        )}
                        Receive goods
                      </button>
                      {!o.vendorBill && (
                        <button
                          type="button"
                          disabled={acting === o.id}
                          onClick={() => linkBill(o.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                        >
                          Link bill
                        </button>
                      )}
                    </>
                  )}
                  {(o.status === 'draft' || o.status === 'issued') && (
                    <button
                      type="button"
                      disabled={acting === o.id}
                      onClick={() => runAction(o.id, 'cancel')}
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      <Ban className="h-4 w-4" />
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
