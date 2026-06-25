'use client';

import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import {
  EssAlert,
  EssCard,
  EssEmptyState,
  EssListItem,
  essInputClass,
  essPrimaryButtonClass,
} from '@/components/ess/EssUi';
import { EssStatusPill } from '@/components/ess/EssStatusPill';

type RequestRow = {
  id: string;
  requestNumber: string;
  title: string;
  status: string;
  totalAmount: number;
  currency: string;
  submittedAt: string | null;
  createdAt: string;
};

function fmtMoney(v: number, currency: string) {
  return `${v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export default function EssProcurementPage() {
  const [items, setItems] = useState<RequestRow[]>([]);
  const [title, setTitle] = useState('');
  const [justification, setJustification] = useState('');
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch('/api/ess/procurement/purchase-requests');
    const data = await res.json().catch(() => ({}));
    if (res.ok) setItems(data.requests ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(submitForApproval: boolean) {
    setError(null);
    setLoading(true);
    if (!navigator.onLine) {
      setError('You are offline. Reconnect before submitting a purchase request.');
      setLoading(false);
      return;
    }
    const res = await fetch('/api/ess/procurement/purchase-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        justification,
        item,
        quantity: Number(quantity),
        unitPrice: Number(unitPrice),
        submit: submitForApproval,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error || 'Failed to submit purchase request');
      return;
    }
    setTitle('');
    setJustification('');
    setItem('');
    setQuantity('1');
    setUnitPrice('');
    await load();
  }

  return (
    <div className="space-y-5">
      <EssPageHeader
        title="Purchase requests"
        subtitle="Request items or services for manager approval."
        backHref="/ess/work"
      />

      <EssCard>
        <p className="text-sm font-black text-[var(--ess-text)]">New request</p>
        <div className="mt-2 space-y-2">
          <input
            className={essInputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you need?"
          />
          <textarea
            className={`${essInputClass} min-h-24`}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Why is this needed?"
          />
          <input
            className={essInputClass}
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="Line item description"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className={essInputClass}
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty"
            />
            <input
              className={essInputClass}
              type="number"
              min="0"
              step="any"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="Unit price (KES)"
            />
          </div>
          {error ? <EssAlert tone="danger">{error}</EssAlert> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => submit(false)}
              className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800"
            >
              Save draft
            </button>
            <button type="button" disabled={loading} onClick={() => submit(true)} className={essPrimaryButtonClass}>
              Submit for approval
            </button>
          </div>
        </div>
      </EssCard>

      <section className="space-y-2">
        <p className="text-sm font-black text-[var(--ess-text)]">My requests</p>
        {items.length === 0 ? (
          <EssEmptyState title="No requests yet" description="Submit a purchase request above." />
        ) : (
          items.map((row) => (
            <EssListItem
              key={row.id}
              title={row.title}
              subtitle={`${row.requestNumber} · ${fmtMoney(row.totalAmount, row.currency)}`}
              trailing={<EssStatusPill status={row.status} />}
            />
          ))
        )}
      </section>
    </div>
  );
}
