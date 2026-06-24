'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ClipboardList,
  Loader2,
  AlertCircle,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type VendorOption = { id: string; name: string; currency: string };

type RequestRow = {
  id: string;
  requestNumber: string;
  title: string;
  department: string | null;
  justification: string;
  currency: string;
  totalAmount: number;
  status: string;
  lineCount: number;
  vendor: { id: string; name: string } | null;
  requestedBy: { id: string; name: string };
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-neutral-100 text-neutral-700',
  submitted: 'bg-blue-50 text-blue-800',
  approved: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-red-50 text-red-800',
  cancelled: 'bg-neutral-100 text-neutral-500',
};

function fmtMoney(v: number, currency = 'KES') {
  return (
    v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency
  );
}

export default function PurchaseRequestsContent() {
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>(() => searchParams.get('status') ?? '');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = filter ? `?status=${filter}` : '';
    fetch(`/api/procurement/purchase-requests${q}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        return data;
      })
      .then((data) => setRequests(data.requests ?? []))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setRequests([]);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status) setFilter(status);
  }, [searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch('/api/procurement/vendors')
      .then(async (r) => (r.ok ? r.json() : { vendors: [] }))
      .then((data) => setVendors(data.vendors ?? []))
      .catch(() => setVendors([]));
  }, []);

  const stats = requests
    ? {
        total: requests.length,
        pending: requests.filter((r) => r.status === 'submitted').length,
        approved: requests.filter((r) => r.status === 'approved').length,
        totalAmount: requests.reduce((s, r) => s + r.totalAmount, 0),
      }
    : null;

  const [form, setForm] = useState({
    title: '',
    department: '',
    justification: '',
    currency: 'KES',
    vendorId: '',
    items: [{ item: '', description: '', quantity: '1', unitPrice: '' }],
  });
  const [submitting, setSubmitting] = useState(false);

  const submitRequest = async () => {
    if (!form.title.trim() || !form.justification.trim()) return;
    const validItems = form.items
      .filter((i) => i.item.trim() && Number(i.quantity) > 0 && Number(i.unitPrice) > 0)
      .map((i) => ({
        item: i.item.trim(),
        description: i.description.trim() || undefined,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      }));
    if (validItems.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/procurement/purchase-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          department: form.department || undefined,
          justification: form.justification,
          currency: form.currency,
          vendorId: form.vendorId || undefined,
          items: validItems,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed');
      }
      setShowForm(false);
      setForm({
        title: '',
        department: '',
        justification: '',
        currency: 'KES',
        vendorId: '',
        items: [{ item: '', description: '', quantity: '1', unitPrice: '' }],
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: string, reason?: string) => {
    try {
      const res = await fetch(`/api/procurement/purchase-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed');
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={ClipboardList}
        title="Purchase requests"
        description="Raise, approve, and track purchase requests before LPO and vendor bill creation in Finance."
        actions={
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New request
          </button>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total requests', value: stats.total, icon: ClipboardList, color: 'text-primary-900' },
            { label: 'Pending approval', value: stats.pending, icon: Clock, color: 'text-blue-700' },
            { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-emerald-700' },
            { label: 'Total value', value: fmtMoney(stats.totalAmount), icon: ClipboardList, color: 'text-primary-900' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="dashboard-stat-card"
            >
              <div className="inline-flex rounded-lg p-2 mb-2 bg-primary-50 text-primary-700">
                <s.icon className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">
                {s.label}
              </p>
              <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-primary-200 bg-primary-50/30 p-5 mb-6 space-y-4"
        >
          <h3 className="font-bold text-primary-900">New purchase request</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              placeholder="Title *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="px-3 py-2 rounded-lg border border-neutral-300 text-sm"
            />
            <input
              placeholder="Department"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="px-3 py-2 rounded-lg border border-neutral-300 text-sm"
            />
            <select
              value={form.vendorId}
              onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
              className="px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white"
            >
              <option value="">Preferred vendor (optional)</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Justification *"
              value={form.justification}
              onChange={(e) => setForm({ ...form, justification: e.target.value })}
              className="px-3 py-2 rounded-lg border border-neutral-300 text-sm sm:col-span-2 lg:col-span-4"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-neutral-700">Line items</p>
            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                <input
                  placeholder="Item *"
                  value={item.item}
                  onChange={(e) => {
                    const items = [...form.items];
                    items[idx] = { ...items[idx]!, item: e.target.value };
                    setForm({ ...form, items });
                  }}
                  className="px-3 py-2 rounded-lg border border-neutral-300 text-sm sm:col-span-2"
                />
                <input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => {
                    const items = [...form.items];
                    items[idx] = { ...items[idx]!, description: e.target.value };
                    setForm({ ...form, items });
                  }}
                  className="px-3 py-2 rounded-lg border border-neutral-300 text-sm sm:col-span-2"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => {
                      const items = [...form.items];
                      items[idx] = { ...items[idx]!, quantity: e.target.value };
                      setForm({ ...form, items });
                    }}
                    className="px-3 py-2 rounded-lg border border-neutral-300 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Unit price"
                    value={item.unitPrice}
                    onChange={(e) => {
                      const items = [...form.items];
                      items[idx] = { ...items[idx]!, unitPrice: e.target.value };
                      setForm({ ...form, items });
                    }}
                    className="px-3 py-2 rounded-lg border border-neutral-300 text-sm"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  items: [...form.items, { item: '', description: '', quantity: '1', unitPrice: '' }],
                })
              }
              className="text-sm text-primary-700 font-semibold hover:text-primary-900"
            >
              + Add line
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitRequest}
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create request'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 py-2 rounded-lg border border-neutral-300 text-sm font-semibold hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'draft', 'submitted', 'approved', 'rejected', 'cancelled'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === s
                ? 'bg-primary-900 text-white'
                : 'bg-white border border-neutral-300 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && requests && requests.length === 0 && (
        <div className="dashboard-surface p-8 text-center text-sm text-neutral-500">
          No purchase requests yet. Create one to start the approval workflow.
        </div>
      )}

      {!loading && !error && requests && requests.length > 0 && (
        <div className="dashboard-surface shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/90">
                  <th className="px-4 py-3 font-semibold text-neutral-700 text-left">#</th>
                  <th className="px-4 py-3 font-semibold text-neutral-700 text-left">Request</th>
                  <th className="px-4 py-3 font-semibold text-neutral-700 text-left">Vendor</th>
                  <th className="px-4 py-3 font-semibold text-neutral-700 text-center">Lines</th>
                  <th className="px-4 py-3 font-semibold text-neutral-700 text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold text-neutral-700 text-center">Status</th>
                  <th className="px-4 py-3 font-semibold text-neutral-700 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-neutral-100 hover:bg-primary-50/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-primary-800">{r.requestNumber}</td>
                    <td className="px-4 py-3 text-neutral-800">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-neutral-500 truncate max-w-[220px]">
                        {r.justification}
                      </div>
                      {r.department && (
                        <div className="text-xs text-neutral-500">{r.department}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{r.vendor?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{r.lineCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary-900">
                      {fmtMoney(r.totalAmount, r.currency)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_STYLES[r.status] || 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {r.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handleAction(r.id, 'submit')}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-700"
                            title="Submit for approval"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        )}
                        {r.status === 'submitted' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAction(r.id, 'approve')}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-700"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const reason = window.prompt('Rejection reason (optional)') ?? undefined;
                                void handleAction(r.id, 'reject', reason);
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-700"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {(r.status === 'draft' || r.status === 'submitted') && (
                          <button
                            type="button"
                            onClick={() => handleAction(r.id, 'cancel')}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-600"
                            title="Cancel"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardPage>
  );
}
