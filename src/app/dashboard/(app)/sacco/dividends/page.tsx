'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

type DividendRun = {
  id: string;
  label: string;
  periodStart: string;
  periodEnd: string;
  ratePercent: number;
  status: string;
  totalAmount: number | null;
  memberCount: number;
};

export default function SaccoDividendsPage() {
  const [runs, setRuns] = useState<DividendRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    label: '',
    periodStart: '',
    periodEnd: '',
    ratePercent: '8',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sacco/dividends');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load dividend runs');
      setRuns(json.runs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dividend runs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/sacco/dividends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ratePercent: Number(form.ratePercent),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create run');
      setForm({ label: '', periodStart: '', periodEnd: '', ratePercent: '8' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create run');
    } finally {
      setCreating(false);
    }
  }

  async function updateRun(id: string, action: 'approve' | 'post' | 'cancel') {
    setError(null);
    const res = await fetch(`/api/sacco/dividends/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Action failed');
      return;
    }
    await load();
  }

  if (loading && runs.length === 0) return <DashboardPageSkeleton />;

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="SACCO"
        title="Dividend runs"
        description="Calculate dividends from share balances, approve, then post to member ledgers."
      />

      <form onSubmit={handleCreate} className="mb-6 grid gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:grid-cols-5">
        <input
          required
          placeholder="Label e.g. Q2 2026"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          className="h-10 rounded-lg border border-neutral-200 px-3 text-sm"
        />
        <input
          required
          type="date"
          value={form.periodStart}
          onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
          className="h-10 rounded-lg border border-neutral-200 px-3 text-sm"
        />
        <input
          required
          type="date"
          value={form.periodEnd}
          onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
          className="h-10 rounded-lg border border-neutral-200 px-3 text-sm"
        />
        <input
          required
          type="number"
          min="0"
          step="0.01"
          placeholder="Rate %"
          value={form.ratePercent}
          onChange={(e) => setForm((f) => ({ ...f, ratePercent: e.target.value }))}
          className="h-10 rounded-lg border border-neutral-200 px-3 text-sm"
        />
        <button
          type="submit"
          disabled={creating}
          className="h-10 rounded-lg bg-primary-500 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
        >
          {creating ? 'Creating…' : 'Create run'}
        </button>
      </form>

      {error ? (
        <DashboardAsyncState variant="error" title="Dividends" message={error} onRetry={() => void load()} />
      ) : (
        <DashboardTableCard title="Dividend runs">
          <DashboardTableViewport>
            <DashboardTable>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Period</th>
                  <th>Rate</th>
                  <th>Members</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{run.label}</td>
                    <td className="text-xs">
                      {run.periodStart} → {run.periodEnd}
                    </td>
                    <td>{run.ratePercent}%</td>
                    <td>{run.memberCount}</td>
                    <td>{run.totalAmount?.toLocaleString() ?? '—'}</td>
                    <td className="capitalize">{run.status}</td>
                    <td className="space-x-2">
                      {run.status === 'draft' ? (
                        <button
                          type="button"
                          onClick={() => void updateRun(run.id, 'approve')}
                          className="text-sm text-primary-600 hover:underline"
                        >
                          Approve
                        </button>
                      ) : null}
                      {run.status === 'approved' ? (
                        <button
                          type="button"
                          onClick={() => void updateRun(run.id, 'post')}
                          className="text-sm text-primary-600 hover:underline"
                        >
                          Post
                        </button>
                      ) : null}
                      {run.status === 'draft' || run.status === 'approved' ? (
                        <button
                          type="button"
                          onClick={() => void updateRun(run.id, 'cancel')}
                          className="text-sm text-neutral-500 hover:underline"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
            {runs.length === 0 ? <DashboardTableEmpty message="No dividend runs yet." /> : null}
          </DashboardTableViewport>
        </DashboardTableCard>
      )}
    </DashboardPage>
  );
}
