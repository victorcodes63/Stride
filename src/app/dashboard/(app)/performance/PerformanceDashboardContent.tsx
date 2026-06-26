'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, PlayCircle, Square } from 'lucide-react';

import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableCell,
  DashboardTableEmpty,
  DashboardTableHead,
  DashboardTableSearchInput,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { ratingLabel } from '@/lib/performance/service';

type Cycle = {
  id: string;
  name: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  reviewCount: number;
};

type ReviewRow = {
  id: string;
  employeeName: string;
  employeeNumber: string | null;
  departmentName: string | null;
  status: string;
  overallSelfRating: number | null;
  overallManagerRating: number | null;
};

function statusClass(status: string) {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-800';
  if (status === 'self_submitted' || status === 'manager_in_progress') return 'bg-amber-100 text-amber-900';
  if (status === 'self_in_progress') return 'bg-blue-100 text-blue-800';
  return 'bg-zinc-100 text-zinc-600';
}

export function PerformanceDashboardContent() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: 'H1 2026 Performance Review',
    periodStart: '2026-01-01',
    periodEnd: '2026-06-30',
    description: 'Mid-year goals and competency review',
  });

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId) ?? cycles[0] ?? null;

  const loadCycles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/performance/cycles', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load cycles');
      setCycles(data.cycles ?? []);
      if (!selectedCycleId && data.cycles?.[0]?.id) {
        setSelectedCycleId(data.cycles[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [selectedCycleId]);

  const loadReviews = useCallback(async (cycleId: string) => {
    const res = await fetch(`/api/performance/reviews?cycleId=${cycleId}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to load reviews');
    setReviews(data.reviews ?? []);
    setStatusCounts(data.statusCounts ?? {});
  }, []);

  useEffect(() => {
    void loadCycles();
  }, [loadCycles]);

  useEffect(() => {
    if (selectedCycle?.id) void loadReviews(selectedCycle.id).catch(() => null);
  }, [selectedCycle?.id, loadReviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter(
      (r) =>
        r.employeeName.toLowerCase().includes(q) ||
        (r.employeeNumber ?? '').toLowerCase().includes(q) ||
        (r.departmentName ?? '').toLowerCase().includes(q),
    );
  }, [reviews, search]);

  async function createCycle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/performance/cycles', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Create failed');
      setCreateOpen(false);
      await loadCycles();
      setSelectedCycleId(data.cycle.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function activateCycle() {
    if (!selectedCycle) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/performance/cycles/${selectedCycle.id}/activate`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Activate failed');
      await loadCycles();
      await loadReviews(selectedCycle.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activate failed');
    } finally {
      setBusy(false);
    }
  }

  async function closeCycle() {
    if (!selectedCycle) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/performance/cycles/${selectedCycle.id}/close`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Close failed');
      await loadCycles();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Close failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Performance management"
        description="Review cycles, employee goals, and manager ratings — replaces the legacy mock KPI dashboard."
        footer={
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Cycle</span>
              <select
                className="mt-1 block min-w-[220px] rounded-lg border border-neutral-200/80 bg-white/90 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900/80"
                value={selectedCycle?.id ?? ''}
                onChange={(e) => setSelectedCycleId(e.target.value)}
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.status})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn-secondary inline-flex h-10 items-center px-3"
              onClick={() => setCreateOpen((v) => !v)}
            >
              New cycle
            </button>
            {selectedCycle?.status === 'draft' ? (
              <button
                type="button"
                disabled={busy}
                className="btn-primary inline-flex h-10 items-center gap-2 px-4 disabled:opacity-50"
                onClick={() => void activateCycle()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Activate cycle
              </button>
            ) : null}
            {selectedCycle?.status === 'active' ? (
              <button
                type="button"
                disabled={busy}
                className="btn-secondary inline-flex h-10 items-center gap-2 px-3 disabled:opacity-50"
                onClick={() => void closeCycle()}
              >
                <Square className="h-4 w-4" />
                Close cycle
              </button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {createOpen ? (
        <div className="mb-6 grid gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            <span className="text-zinc-500">Name</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-500">Period start</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
              value={form.periodStart}
              onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-500">Period end</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
              value={form.periodEnd}
              onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            className="md:col-span-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => void createCycle()}
          >
            Create draft cycle
          </button>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          ['Total reviews', selectedCycle?.reviewCount ?? reviews.length],
          ['Self submitted', statusCounts.self_submitted ?? 0],
          ['Manager done', statusCounts.completed ?? 0],
          ['Not started', statusCounts.not_started ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <DashboardTableCard>
        <DashboardTableToolbar>
          <DashboardTableSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search employee, number, department…"
          />
        </DashboardTableToolbar>
        <DashboardTableViewport>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading reviews…
            </div>
          ) : (
            <DashboardTable>
              <thead>
                <tr>
                  <DashboardTableHead>Employee</DashboardTableHead>
                  <DashboardTableHead>Department</DashboardTableHead>
                  <DashboardTableHead>Status</DashboardTableHead>
                  <DashboardTableHead>Self rating</DashboardTableHead>
                  <DashboardTableHead>Manager rating</DashboardTableHead>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <DashboardTableEmpty colSpan={5}>
                    {selectedCycle?.status === 'draft'
                      ? 'Activate the cycle to create reviews for all active employees.'
                      : 'No reviews match your search.'}
                  </DashboardTableEmpty>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id} className="border-t border-zinc-100">
                      <DashboardTableCell>
                        <div className="font-medium">{row.employeeName}</div>
                        {row.employeeNumber ? (
                          <div className="text-xs text-zinc-500">{row.employeeNumber}</div>
                        ) : null}
                      </DashboardTableCell>
                      <DashboardTableCell>{row.departmentName ?? '—'}</DashboardTableCell>
                      <DashboardTableCell>
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>
                          {row.status.replace(/_/g, ' ')}
                        </span>
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {row.overallSelfRating
                          ? `${row.overallSelfRating}/5 · ${ratingLabel(row.overallSelfRating)}`
                          : '—'}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {row.overallManagerRating
                          ? `${row.overallManagerRating}/5 · ${ratingLabel(row.overallManagerRating)}`
                          : '—'}
                      </DashboardTableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </DashboardTable>
          )}
        </DashboardTableViewport>
      </DashboardTableCard>
    </DashboardPage>
  );
}
