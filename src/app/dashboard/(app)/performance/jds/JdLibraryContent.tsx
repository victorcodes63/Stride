'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, Plus, Upload } from 'lucide-react';

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
import type { JobDescriptionDto } from '@/lib/performance/jd/types';

function statusClass(status: string) {
  if (status === 'published') return 'bg-emerald-100 text-emerald-800';
  if (status === 'archived') return 'bg-zinc-100 text-zinc-600';
  return 'bg-amber-100 text-amber-900';
}

export function JdLibraryContent() {
  const [rows, setRows] = useState<JobDescriptionDto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/performance/jds', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load job descriptions');
      setRows(data.jobDescriptions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.grade ?? '').toLowerCase().includes(q) ||
        (r.divisionName ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function importReferencePack() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/performance/jds/reference-pack', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replaceExisting: rows.some((r) => r.isReferencePack) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Job description library"
        description="Manual JD entry is the default — structured 10-section roles, KRAs, KPIs, and competencies. No data leaves your tenant unless you enable AI parsing in Company Setup."
        footer={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/performance/jds/new" className="btn-primary inline-flex h-10 items-center gap-2 px-4">
              <Plus className="h-4 w-4" />
              New JD
            </Link>
            <button
              type="button"
              disabled={busy}
              className="btn-secondary inline-flex h-10 items-center gap-2 px-3 disabled:opacity-50"
              onClick={() => void importReferencePack()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import Stabex reference pack
            </button>
            <Link href="/dashboard/performance" className="btn-secondary inline-flex h-10 items-center gap-2 px-3">
              <BookOpen className="h-4 w-4" />
              Review cycles
            </Link>
          </div>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <DashboardTableCard>
        <DashboardTableToolbar>
          <DashboardTableSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search title, grade, division…"
          />
        </DashboardTableToolbar>
        <DashboardTableViewport>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading job descriptions…
            </div>
          ) : (
            <DashboardTable>
              <thead>
                <tr>
                  <DashboardTableHead>Role</DashboardTableHead>
                  <DashboardTableHead>Division</DashboardTableHead>
                  <DashboardTableHead>Grade</DashboardTableHead>
                  <DashboardTableHead>Status</DashboardTableHead>
                  <DashboardTableHead>KRAs</DashboardTableHead>
                  <DashboardTableHead>Competencies</DashboardTableHead>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <DashboardTableEmpty colSpan={6}>
                    No job descriptions yet. Create one manually or import the Stabex reference pack (83 roles / 13 divisions).
                  </DashboardTableEmpty>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id} className="border-t border-zinc-100">
                      <DashboardTableCell>
                        <Link
                          href={`/dashboard/performance/jds/${row.id}`}
                          className="font-medium text-primary-800 hover:underline"
                        >
                          {row.title}
                        </Link>
                        <div className="text-xs text-zinc-500">v{row.version}</div>
                      </DashboardTableCell>
                      <DashboardTableCell>{row.divisionName ?? '—'}</DashboardTableCell>
                      <DashboardTableCell>{row.grade ?? '—'}</DashboardTableCell>
                      <DashboardTableCell>
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>
                          {row.status}
                        </span>
                      </DashboardTableCell>
                      <DashboardTableCell>{row.kraCount}</DashboardTableCell>
                      <DashboardTableCell>{row.competencyCount}</DashboardTableCell>
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
