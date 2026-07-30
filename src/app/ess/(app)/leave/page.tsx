'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3 } from 'lucide-react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssBottomSheet } from '@/components/ess/EssBottomSheet';
import { EssStatusPill } from '@/components/ess/EssStatusPill';
import { EssPullRefresh } from '@/components/ess/EssPullRefresh';
import {
  EssAlert,
  EssEmptyState,
  EssSectionTitle,
  essInputClass,
  essPrimaryButtonClass,
} from '@/components/ess/EssUi';
import { StrideSelect } from '@/components/ui/stride-select';

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
  createdAt?: string;
  updatedAt?: string;
};

function formatDay(value: string) {
  return new Date(value).toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusHelper(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'pending') return 'Waiting for manager / HR review';
  if (normalized === 'approved') return 'Approved — days deducted from balance';
  if (normalized === 'rejected') return 'Rejected — balance unchanged';
  return status;
}

function LeaveRequestCard({ row }: { row: LeaveRow }) {
  const sameDay =
    new Date(row.startDate).toDateString() === new Date(row.endDate).toDateString();

  return (
    <article className="ess-card-flat overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--ess-border)] px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ess-muted)]">
            Leave request
          </p>
          <h3 className="mt-1 text-base font-black text-[var(--ess-text)]">{row.leaveTypeName}</h3>
        </div>
        <EssStatusPill status={row.status} />
      </div>

      <div className="space-y-3 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ess-primary-soft)] text-[var(--ess-primary)]">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--ess-text)]">
              {sameDay ? formatDay(row.startDate) : `${formatShortDate(row.startDate)} – ${formatShortDate(row.endDate)}`}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--ess-muted)]">
              {row.days} day{row.days === 1 ? '' : 's'} · {statusHelper(row.status)}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-[var(--ess-surface-soft)] px-3 py-2">
            <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">Duration</dt>
            <dd className="mt-0.5 font-black text-[var(--ess-text)]">
              {row.days} day{row.days === 1 ? '' : 's'}
            </dd>
          </div>
          <div className="rounded-2xl bg-[var(--ess-surface-soft)] px-3 py-2">
            <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">Submitted</dt>
            <dd className="mt-0.5 font-black text-[var(--ess-text)]">
              {row.createdAt ? formatShortDate(row.createdAt) : '—'}
            </dd>
          </div>
        </dl>

        {row.reason ? (
          <div className="rounded-2xl border border-[var(--ess-border)] bg-[var(--ess-surface)] px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">Reason</p>
            <p className="mt-1 text-sm leading-5 text-[var(--ess-text)]">{row.reason}</p>
          </div>
        ) : (
          <p className="text-xs font-semibold text-[var(--ess-subtle)]">No reason provided</p>
        )}

        {row.updatedAt && row.createdAt && row.updatedAt !== row.createdAt ? (
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--ess-muted)]">
            <Clock3 className="h-3.5 w-3.5" />
            Last updated {formatShortDate(row.updatedAt)}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function BalanceCard({ balance, featured }: { balance: LeaveBalance; featured?: boolean }) {
  if (featured) {
    return (
      <div className="ess-card overflow-hidden p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--ess-muted)]">
              {balance.leaveTypeName}
            </p>
            <p className="mt-2 text-3xl font-black tracking-tight text-[var(--ess-text)]">
              {balance.remaining}
            </p>
            <p className="mt-1 text-sm text-[var(--ess-muted)]">days remaining</p>
          </div>
          <span className="rounded-full bg-[var(--ess-primary-soft)] px-2.5 py-1 text-[11px] font-black text-[var(--ess-primary)]">
            Primary
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ['Entitled', balance.entitled],
            ['Used', balance.used],
            ['Pending', balance.pending],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-[var(--ess-surface-soft)] px-2 py-2">
              <dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--ess-muted)]">{label}</dt>
              <dd className="mt-0.5 text-sm font-black text-[var(--ess-text)]">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--ess-border)] bg-[var(--ess-surface)] px-3 py-3">
      <p className="truncate text-xs font-bold text-[var(--ess-text)]">{balance.leaveTypeName}</p>
      <p className="mt-1 text-lg font-black text-[var(--ess-text)]">
        {balance.remaining}
        <span className="ml-1 text-xs font-bold text-[var(--ess-muted)]">left</span>
      </p>
      <p className="mt-1 text-[10px] font-semibold text-[var(--ess-muted)]">
        {balance.used} used · {balance.pending} pending
      </p>
    </div>
  );
}

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
  const otherBalances = useMemo(
    () => balances.filter((b) => b.leaveTypeId !== primaryBalance?.leaveTypeId),
    [balances, primaryBalance?.leaveTypeId],
  );
  const pendingCount = rows.filter((r) => r.status.toLowerCase() === 'pending').length;
  const approvedDays = rows
    .filter((r) => r.status.toLowerCase() === 'approved')
    .reduce((sum, r) => sum + r.days, 0);

  return (
    <>
      <EssPullRefresh onRefresh={load}>
        <div className="space-y-5 pb-20">
          <EssPageHeader title="Leave" subtitle="Balances, history, and request status" />

          {primaryBalance ? <BalanceCard balance={primaryBalance} featured /> : null}

          {otherBalances.length ? (
            <section>
              <EssSectionTitle eyebrow="Balances" title="All leave types" />
              <div className="grid grid-cols-2 gap-2">
                {otherBalances.map((b) => (
                  <BalanceCard key={b.leaveTypeId} balance={b} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-[var(--ess-border)] bg-[var(--ess-surface)] px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">Open requests</p>
              <p className="mt-1 text-xl font-black text-[var(--ess-text)]">{pendingCount}</p>
            </div>
            <div className="rounded-2xl border border-[var(--ess-border)] bg-[var(--ess-surface)] px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">Approved days</p>
              <p className="mt-1 text-xl font-black text-[var(--ess-text)]">{approvedDays}</p>
            </div>
          </section>

          <section>
            <EssSectionTitle eyebrow="History" title="Your requests" subtitle="Dates, duration, reason, and review status" />
            <div className="space-y-3">
              {rows.map((row) => (
                <LeaveRequestCard key={row.id} row={row} />
              ))}
              {!rows.length ? (
                <EssEmptyState
                  title="No leave requests yet"
                  message="Submitted requests and approvals will appear here with full detail."
                />
              ) : null}
            </div>
          </section>
        </div>
      </EssPullRefresh>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-[calc(var(--ess-tab-height)+env(safe-area-inset-bottom)+1rem)] left-1/2 z-20 min-h-12 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-full bg-primary-600 px-6 text-base font-semibold text-white shadow-lg sm:w-auto"
      >
        Request leave
      </button>

      <EssBottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Request leave">
        {error ? (
          <div className="mb-3">
            <EssAlert tone="danger">{error}</EssAlert>
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-[var(--ess-text)]">Leave type</span>
            <StrideSelect
              surface="ess"
              className="mt-1"
              triggerClassName="ess-field-compact"
              ariaLabel="Leave type"
              value={form.leaveTypeId}
              onChange={(value) => setForm((f) => ({ ...f, leaveTypeId: value }))}
              options={types.map((t) => ({ value: t.id, label: t.name }))}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-bold text-[var(--ess-text)]">Start</span>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className={`${essInputClass} ess-field-compact mt-1`}
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-[var(--ess-text)]">End</span>
              <input
                type="date"
                required
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className={`${essInputClass} ess-field-compact mt-1`}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-bold text-[var(--ess-text)]">Reason (optional)</span>
            <textarea
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3}
              placeholder="Add context for your manager"
              className={`${essInputClass} mt-1 min-h-[5.5rem] resize-none`}
            />
          </label>
          <button type="submit" disabled={saving} className={`${essPrimaryButtonClass} w-full`}>
            {saving ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      </EssBottomSheet>
    </>
  );
}
