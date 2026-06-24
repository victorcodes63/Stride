'use client';

import { useEffect, useMemo, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssStatusPill } from '@/components/ess/EssStatusPill';
import { EssPullRefresh } from '@/components/ess/EssPullRefresh';

type TeamLeaveRow = {
  id: string;
  employeeName: string;
  employeeNumber: string | null;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason: string | null;
};

export function EssLeaveApprovals({ backHref = '/ess/team' }: { backHref?: string }) {
  const [rows, setRows] = useState<TeamLeaveRow[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  async function load() {
    const res = await fetch('/api/ess/leave/team');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Could not load leave approvals.');
      return;
    }
    setRows(Array.isArray(data) ? data : []);
    setError('');
  }

  useEffect(() => {
    load().catch(() => setError('Could not load leave approvals.'));
  }, []);

  const pendingCount = useMemo(() => rows.filter((r) => r.status === 'pending').length, [rows]);

  const visible = useMemo(
    () => (filter === 'pending' ? rows.filter((r) => r.status === 'pending') : rows),
    [rows, filter],
  );

  async function review(id: string, status: 'approved' | 'rejected') {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/ess/leave/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note: notes[id] || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not update leave status.');
        return;
      }
      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, status: data.status ?? status } : row)),
      );
    } catch {
      setError('Could not update leave status.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <EssPullRefresh onRefresh={load}>
      <EssPageHeader
        title="Leave approvals"
        subtitle={`${pendingCount} pending`}
        backHref={backHref}
      />

      <div className="mb-4 flex gap-2">
        {(['pending', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`min-h-11 rounded-full px-4 text-sm font-medium ${
              filter === f ? 'bg-primary-600 text-white' : 'bg-white border border-neutral-200 text-neutral-700'
            }`}
          >
            {f === 'pending' ? 'Pending' : 'All'}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="space-y-3">
        {visible.map((row) => (
          <article key={row.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-neutral-900">{row.employeeName}</p>
                <p className="text-xs text-neutral-500">{row.employeeNumber || '—'}</p>
              </div>
              <EssStatusPill status={row.status} />
            </div>
            <p className="mt-2 text-sm text-neutral-700">
              {row.leaveTypeName} · {row.days} day{row.days === 1 ? '' : 's'}
            </p>
            <p className="text-sm text-neutral-600">
              {new Date(row.startDate).toLocaleDateString()} – {new Date(row.endDate).toLocaleDateString()}
            </p>
            {row.reason ? <p className="mt-2 text-sm text-neutral-500">{row.reason}</p> : null}

            {row.status === 'pending' ? (
              <div className="mt-4 space-y-2">
                <input
                  type="text"
                  value={notes[row.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  placeholder="Note (optional)"
                  className="w-full min-h-11 rounded-lg border border-neutral-300 px-3 text-base"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => review(row.id, 'approved')}
                    className="min-h-11 flex-1 rounded-lg bg-emerald-600 text-sm font-medium text-white disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => review(row.id, 'rejected')}
                    className="min-h-11 flex-1 rounded-lg bg-red-600 text-sm font-medium text-white disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        ))}
        {!visible.length ? (
          <p className="rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
            No leave requests in this view.
          </p>
        ) : null}
      </div>
    </EssPullRefresh>
  );
}
