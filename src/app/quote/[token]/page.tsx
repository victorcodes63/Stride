'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PublicDocumentShell } from '@/components/public/PublicDocumentShell';
import { StrideButton } from '@/components/ui/stride-button';

type QuoteInfo = {
  valid: boolean;
  quoteNumber: number;
  version: number;
  title: string;
  status: string;
  currency: string;
  issueDate: string;
  validUntil: string | null;
  taxRateBps: number;
  discountPct: number;
  notes: string | null;
  terms: string | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
  clientName: string;
  companyName: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discountPct: number;
    amount: number;
  }>;
  totals: {
    subtotal: number;
    discountAmount: number;
    netAmount: number;
    taxAmount: number;
    total: number;
  };
};

function money(n: number, currency: string) {
  return `${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function shortDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function QuoteAcceptPage() {
  const params = useParams();
  const token = params.token as string;
  const [info, setInfo] = useState<QuoteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [done, setDone] = useState<{ message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/quote/accept?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid !== false && !data.error) {
          setInfo(data);
        } else {
          setError(data.error || 'Invalid or expired link.');
        }
      })
      .catch(() => setError('Failed to load.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/quote/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, acceptedByName: name }),
      });
      const data = await res.json();
      if (data.success) {
        setDone({ message: data.message });
      } else {
        setError(data.error || 'Something went wrong.');
      }
    } catch {
      setError('Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pub-surface-muted px-5 font-pub">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-pub-border border-t-pub-primary" />
          <p className="text-sm text-pub-ink-muted">Loading quote…</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <PublicDocumentShell title="Quote accepted" description={done.message}>
        <p className="text-sm text-pub-ink-muted">You can close this page.</p>
      </PublicDocumentShell>
    );
  }

  if (error && !info) {
    return (
      <PublicDocumentShell title="Invalid link" description={error}>
        <p className="text-sm text-pub-ink-muted">Ask your sales contact for a fresh quote link.</p>
      </PublicDocumentShell>
    );
  }

  if (!info) return null;

  const alreadyAccepted = Boolean(info.acceptedAt);
  const canAccept = info.status === 'sent' && !alreadyAccepted;

  return (
    <PublicDocumentShell
      title={info.title}
      description={`${info.companyName} · Q-${String(info.quoteNumber).padStart(4, '0')} v${info.version}`}
    >
      {error ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </p>
      ) : null}

      <div className="space-y-4 text-sm text-pub-ink">
        <div className="rounded-lg border border-pub-border bg-pub-surface-muted p-4 text-pub-ink-muted">
          <p>
            <strong className="text-pub-ink">Prepared for:</strong> {info.clientName}
          </p>
          <p className="mt-1">
            <strong className="text-pub-ink">Issued:</strong> {shortDate(info.issueDate)}
            {info.validUntil ? ` · Valid until ${shortDate(info.validUntil)}` : ''}
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-pub-border">
          <table className="min-w-full text-sm">
            <thead className="bg-pub-surface-muted text-left text-xs uppercase tracking-wide text-pub-ink-muted">
              <tr>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {info.lineItems.map((li, i) => (
                <tr key={i} className="border-t border-pub-border">
                  <td className="px-3 py-2">{li.description}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{li.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(li.amount, info.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="space-y-1 text-right text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-pub-ink-muted">Subtotal</dt>
            <dd className="tabular-nums">{money(info.totals.subtotal, info.currency)}</dd>
          </div>
          {info.totals.discountAmount > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-pub-ink-muted">Discount</dt>
              <dd className="tabular-nums">−{money(info.totals.discountAmount, info.currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-pub-ink-muted">VAT ({(info.taxRateBps / 100).toFixed(0)}%)</dt>
            <dd className="tabular-nums">{money(info.totals.taxAmount, info.currency)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-pub-border pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(info.totals.total, info.currency)}</dd>
          </div>
        </dl>

        {info.terms ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-pub-ink-muted">Terms</p>
            <p className="mt-1 whitespace-pre-wrap text-pub-ink-muted">{info.terms}</p>
          </div>
        ) : null}

        {alreadyAccepted ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Accepted{info.acceptedByName ? ` by ${info.acceptedByName}` : ''}
            {info.acceptedAt ? ` on ${shortDate(info.acceptedAt)}` : ''}.
          </p>
        ) : canAccept ? (
          <div className="space-y-3 border-t border-pub-border pt-4">
            <label className="block text-sm font-medium text-pub-ink">
              Your full name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-pub-border bg-white px-3 py-2 text-pub-ink"
                placeholder="Jane Wanjiku"
                autoComplete="name"
              />
            </label>
            <StrideButton
              surface="public"
              variant="primary"
              className="w-full disabled:opacity-60"
              onClick={() => void handleAccept()}
              disabled={submitting || name.trim().length < 2}
            >
              {submitting ? 'Accepting…' : 'Accept this quote'}
            </StrideButton>
          </div>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This quote is not open for acceptance (status: {info.status}).
          </p>
        )}
      </div>
    </PublicDocumentShell>
  );
}
