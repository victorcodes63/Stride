'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

export function BillingAutomationPanel({ clientId }: { clientId?: string }) {
  const [month, setMonth] = useState(String(new Date().getUTCMonth() + 1));
  const [year, setYear] = useState(String(new Date().getUTCFullYear()));
  const [busy, setBusy] = useState<'recurring' | 'payroll' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!clientId) return null;

  async function run(kind: 'recurring' | 'payroll') {
    setBusy(kind);
    setError(null);
    setMessage(null);
    const path =
      kind === 'recurring' ? '/api/accounts/billing/recurring' : '/api/accounts/billing/from-payroll';
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, month: parseInt(month, 10), year: parseInt(year, 10) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setMessage(`Draft invoice #${data.invoiceNumber} created.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="dashboard-surface p-4 mb-6 border border-primary-100">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-primary-700" />
        <h2 className="text-sm font-semibold text-primary-900">Billing automation</h2>
      </div>
      <p className="text-xs text-neutral-600 mb-3">
        Generate draft invoices from headcount × rate card or from an approved payroll run (pass-through + markup).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="block text-neutral-600 mb-1">Month</span>
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="block text-neutral-600 mb-1">Year</span>
          <input
            type="number"
            min={2020}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void run('recurring')}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-900 text-white text-xs font-semibold disabled:opacity-50"
        >
          {busy === 'recurring' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Recurring bill
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void run('payroll')}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
        >
          {busy === 'payroll' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          From payroll
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-emerald-700">{message}</p>}
      {error && <p className="mt-2 text-xs text-amber-800">{error}</p>}
    </div>
  );
}
