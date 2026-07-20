'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

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

type ScorecardRow = {
  id: string;
  title: string;
  grade: string | null;
  jobDescriptionVersion: number;
  resultsWeightPercent: number;
  competenciesWeightPercent: number;
  measureCount: number;
  competencyCount: number;
};

function BlendBar({ results, competencies }: { results: number; competencies: number }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-4 w-24 overflow-hidden rounded"
        role="img"
        aria-label={`${results}% results, ${competencies}% competencies`}
      >
        <div style={{ width: `${results}%`, backgroundColor: 'var(--swatch-coral-accent)' }} />
        <div style={{ width: `${competencies}%`, backgroundColor: 'var(--swatch-sky-accent)' }} />
      </div>
      <span className="text-xs tabular-nums text-[var(--dash-text-muted)]">
        {results}/{competencies}
      </span>
    </div>
  );
}

export function ScorecardLibraryContent() {
  const [rows, setRows] = useState<ScorecardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/performance/scorecards', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load scorecards');
      setRows(data.templates ?? []);
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
      (r) => r.title.toLowerCase().includes(q) || (r.grade ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="BSC scorecards"
        description="Results and competencies with weighted BSC blend."
        footer={
          <Link href="/dashboard/performance/jds" className="btn-secondary h-10 px-3">
            Job descriptions
          </Link>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <DashboardTableCard>
        <DashboardTableToolbar>
          <DashboardTableSearchInput value={search} onChange={setSearch} placeholder="Search role, grade…" />
        </DashboardTableToolbar>
        <DashboardTableViewport>
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-[var(--dash-surface-muted)]" />
              ))}
            </div>
          ) : (
            <DashboardTable>
              <thead>
                <tr>
                  <DashboardTableHead>Role</DashboardTableHead>
                  <DashboardTableHead>JD version</DashboardTableHead>
                  <DashboardTableHead>Blend (R/C)</DashboardTableHead>
                  <DashboardTableHead>Measures</DashboardTableHead>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <DashboardTableEmpty colSpan={4}>
                    {search
                      ? 'No scorecards match your search.'
                      : 'Publish a JD and click "Generate BSC scorecard" to create a template.'}
                  </DashboardTableEmpty>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--dash-border-subtle)]">
                      <DashboardTableCell>
                        <Link
                          href={`/dashboard/performance/scorecards/${row.id}`}
                          className="font-medium text-primary-800 hover:underline"
                        >
                          {row.title}
                        </Link>
                        {row.grade ? (
                          <div className="text-xs text-[var(--dash-text-muted)]">{row.grade}</div>
                        ) : null}
                      </DashboardTableCell>
                      <DashboardTableCell>v{row.jobDescriptionVersion}</DashboardTableCell>
                      <DashboardTableCell>
                        <BlendBar results={row.resultsWeightPercent} competencies={row.competenciesWeightPercent} />
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {row.measureCount} KPIs · {row.competencyCount} competencies
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
