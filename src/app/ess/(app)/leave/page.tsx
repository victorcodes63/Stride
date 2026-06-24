'use client';

import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssBottomSheet } from '@/components/ess/EssBottomSheet';
import { EssStatusPill } from '@/components/ess/EssStatusPill';
import { EssPullRefresh } from '@/components/ess/EssPullRefresh';
import { EssAlert, EssEmptyState, EssListItem, EssMetricCard, EssSectionTitle, essInputClass, essPrimaryButtonClass } from '@/components/ess/EssUi';

type LeaveType = { id: string; name: string; daysPerYear: number };
type LeaveBalance = {
  leaveTypeId: string;
  leaveTypeName: string;
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
};
type LeaveRow = {
  id: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason: string | null;
};

export default function EssLeavePage() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });

  async function load() {
    const [typesRes, rowsRes, balancesRes] = await Promise.all([
      fetch('/api/ess/leave/types'),
      fetch('/api/ess/leave/applications'),
      fetch('/api/ess/leave/balances'),
    ]);
    const t = await typesRes.json().catch(() => []);
    const r = await rowsRes.json().catch(() => []);
    const b = await balancesRes.json().catch(() => []);
    setTypes(Array.isArray(t) ? t : []);
    setRows(Array.isArray(r) ? r : []);
    setBalances(Array.isArray(b) ? b : []);
    if (Array.isArray(t) && t[0] && !form.leaveTypeId) {
      setForm((prev) => ({ ...prev, leaveTypeId: t[0].id }));
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) {
      setError('You are offline. Reconnect before submitting a leave request.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/ess/leave/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not submit leave request.');
        return;
      }
      setSheetOpen(false);
      setForm((prev) => ({ ...prev, startDate: '', endDate: '', reason: '' }));
      await load();
    } catch {
      setError('Could not submit leave request.');
    } finally {
      setSaving(false);
    }
  }

  const primaryBalance = balances[0];

  return (
    <>
      <EssPullRefresh onRefresh={load}>
        <EssPageHeader title="Leave" subtitle="Balances and requests" backHref="/ess/work" />

        {primaryBalance ? (
          <div className="mb-4">
            <EssMetricCard
              label={primaryBalance.leaveTypeName}
              value={primaryBalance.remaining}
              helper="days remaining"
              tone="primary"
            />
          </div>
        ) : null}

        <div className="mb-4 grid grid-cols-2 gap-2">
          {balances.map((b) => (
            <span
              key={b.leaveTypeId}
              className="rounded-2xl border border-[var(--ess-border)] bg-[var(--ess-surface)] px-3 py-2 text-xs font-bold text-[var(--ess-text)]"
            >
              {b.leaveTypeName}: {b.remaining} left
            </span>
          ))}
        </div>

        <EssSectionTitle eyebrow="History" title="Your requests" />
        <div className="space-y-3">
          {rows.map((row) => (
            <EssListItem
              key={row.id}
              title={row.leaveTypeName}
              subtitle={`${new Date(row.startDate).toLocaleDateString()} - ${new Date(row.endDate).toLocaleDateString()} · ${row.days}d`}
              meta={row.reason}
              trailing={<EssStatusPill status={row.status} />}
            />
          ))}
          {!rows.length ? (
            <EssEmptyState title="No leave requests yet" message="Submitted requests and approvals will appear here." />
          ) : null}
        </div>
      </EssPullRefresh>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-[calc(var(--ess-tab-height)+env(safe-area-inset-bottom)+1rem)] left-1/2 z-20 min-h-12 -translate-x-1/2 rounded-full bg-primary-600 px-6 text-base font-semibold text-white shadow-lg max-w-lg w-[calc(100%-2rem)] sm:w-auto"
      >
        Request leave
      </button>

      <EssBottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Request leave">
        {error ? <div className="mb-3"><EssAlert tone="danger">{error}</EssAlert></div> : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-[var(--ess-text)]">Leave type</span>
            <select
              value={form.leaveTypeId}
              onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
              className={`${essInputClass} mt-1`}
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[var(--ess-text)]">Start date</span>
            <input
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className={`${essInputClass} mt-1`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[var(--ess-text)]">End date</span>
            <input
              type="date"
              required
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              className={`${essInputClass} mt-1`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[var(--ess-text)]">Reason (optional)</span>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              className={`${essInputClass} mt-1`}
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className={`${essPrimaryButtonClass} w-full`}
          >
            {saving ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      </EssBottomSheet>
    </>
  );
}
