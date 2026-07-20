'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Download, FileText, Loader2, Plus, Upload, X } from 'lucide-react';

import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableActionButton,
  DashboardTableActions,
  DashboardTableCard,
  DashboardTableCell,
  DashboardTableEmpty,
  DashboardTableFooter,
  DashboardTableHead,
  DashboardTableSearchInput,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { isPublicDemoMode } from '@/lib/deployment-flags';
import { jdManualImportTemplateJson } from '@/lib/performance/jd/jd-manual-import';
import type { JobDescriptionDto, JobDescriptionInput } from '@/lib/performance/jd/types';
import { dashStatusChip, type DashStatusTone } from '@/lib/dashboard-status-chips';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';

const PAGE_SIZE = 10;

type SortKey = 'title' | 'division' | 'grade' | 'status' | 'kras' | 'competencies';
type SortDir = 'asc' | 'desc';

function statusTone(status: string): DashStatusTone {
  if (status === 'published') return 'success';
  if (status === 'archived') return 'neutral';
  return 'warning';
}

function downloadTemplate() {
  const blob = new Blob([jdManualImportTemplateJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'stride-jd-manual-template.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function JdLibraryContent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<JobDescriptionDto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'title', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const showDemoPack = isPublicDemoMode();

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
    const matched = !q
      ? rows
      : rows.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            (r.grade ?? '').toLowerCase().includes(q) ||
            (r.divisionName ?? '').toLowerCase().includes(q),
        );
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...matched].sort((a, b) => {
      switch (sort.key) {
        case 'division':
          return dir * (a.divisionName ?? '').localeCompare(b.divisionName ?? '');
        case 'grade':
          return dir * (a.grade ?? '').localeCompare(b.grade ?? '');
        case 'status':
          return dir * a.status.localeCompare(b.status);
        case 'kras':
          return dir * (a.kraCount - b.kraCount);
        case 'competencies':
          return dir * (a.competencyCount - b.competencyCount);
        default:
          return dir * a.title.localeCompare(b.title);
      }
    });
  }, [rows, search, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  }

  async function exportPdf(id: string) {
    setPdfBusyId(id);
    try {
      const res = await fetch(`/api/performance/jds/${id}/pdf`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'PDF export failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = match?.[1] ?? 'job-description.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF export failed');
    } finally {
      setPdfBusyId(null);
    }
  }

  async function importSingleRoleText(text: string, fileName: string) {
    const parseRes = await fetch('/api/performance/jds/parse', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, text }),
    });
    const parseData = await parseRes.json();
    if (!parseRes.ok) throw new Error(parseData.error ?? 'Could not parse document');

    const draft = parseData.draft as JobDescriptionInput;
    const createRes = await fetch('/api/performance/jds', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.error ?? 'Failed to create job description');

    const id = createData.jobDescription?.id as string | undefined;
    if (id) {
      router.push(`/dashboard/performance/jds/${id}`);
      return;
    }
    await load();
    setImportMessage('Imported one role from your document — review and publish when ready.');
  }

  async function importBulkManual(file: File) {
    const form = new FormData();
    form.append('file', file);
    form.append('skipDuplicates', 'true');

    const res = await fetch('/api/performance/jds/import-manual', {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Import failed');

    const skipped = data.skippedCount ? ` (${data.skippedCount} duplicates skipped)` : '';
    setImportMessage(
      `Imported ${data.roleCount} role(s) across ${data.divisionCount} division(s) as drafts${skipped}. Review each JD before publishing.`,
    );
    await load();
  }

  async function handleImportFile(file: File) {
    setBusy(true);
    setError(null);
    setImportMessage(null);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.json')) {
        await importBulkManual(file);
      } else if (lower.endsWith('.txt') || lower.endsWith('.md')) {
        const text = await file.text();
        await importSingleRoleText(text, file.name);
      } else {
        throw new Error('Use a .json manual for bulk import, or .txt / .md for a single role document.');
      }
      setImportOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function importDemoReferencePack() {
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
        description="Structured role profiles — KRAs, KPIs, and competencies."
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
              onClick={() => setImportOpen(true)}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import JD manual
            </button>
            <button
              type="button"
              className="btn-secondary inline-flex h-10 items-center gap-2 px-3"
              onClick={downloadTemplate}
            >
              <Download className="h-4 w-4" />
              Download template
            </button>
            {showDemoPack ? (
              <button
                type="button"
                disabled={busy}
                className="btn-secondary inline-flex h-10 items-center gap-2 px-3 text-xs disabled:opacity-50"
                onClick={() => void importDemoReferencePack()}
              >
                Demo pack (dev)
              </button>
            ) : null}
            <Link href="/dashboard/performance" className="btn-secondary inline-flex h-10 items-center gap-2 px-3">
              <BookOpen className="h-4 w-4" />
              Review cycles
            </Link>
          </div>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.txt,.md,application/json,text/plain,text/markdown"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
        }}
      />

      {importOpen ? (
        <div className={`mb-4 ${DASHBOARD_SURFACE_CLASS} p-5 shadow-sm`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">Import your JD manual</h3>
              <p className="mt-1 max-w-2xl text-sm text-[var(--dash-text-muted)]">
                Upload your organisation&apos;s job description manual — not a Stride demo dataset.
                Use the JSON template for bulk import (many roles and divisions). Use a plain-text
                export (.txt / .md) for one role at a time; we extract sections locally without AI.
              </p>
              <ul className="mt-3 list-inside list-disc text-sm text-[var(--dash-text-muted)]">
                <li>
                  <strong className="font-medium text-[var(--dash-text-strong)]">Bulk:</strong>{' '}
                  <code className="text-xs">.json</code> — divisions + roles with KRAs, KPIs, competencies
                </li>
                <li>
                  <strong className="font-medium text-[var(--dash-text-strong)]">Single role:</strong>{' '}
                  <code className="text-xs">.txt</code> or <code className="text-xs">.md</code> — opens the editor to
                  review before publish
                </li>
              </ul>
            </div>
            <button
              type="button"
              className="rounded-lg p-1 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
              aria-label="Close import panel"
              onClick={() => setImportOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="btn-primary inline-flex h-10 items-center gap-2 px-4 disabled:opacity-50"
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Choose file
            </button>
            <button type="button" className="btn-secondary inline-flex h-10 items-center gap-2 px-3" onClick={downloadTemplate}>
              <Download className="h-4 w-4" />
              Download JSON template
            </button>
          </div>
        </div>
      ) : null}

      {importMessage ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {importMessage}
        </div>
      ) : null}

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
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-[var(--dash-surface-muted)]" />
              ))}
            </div>
          ) : (
            <DashboardTable>
              <thead>
                <tr>
                  <JdSortHead label="Role" sortKey="title" sort={sort} onSort={toggleSort} />
                  <JdSortHead label="Division" sortKey="division" sort={sort} onSort={toggleSort} />
                  <JdSortHead label="Grade" sortKey="grade" sort={sort} onSort={toggleSort} />
                  <JdSortHead label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                  <JdSortHead label="KRAs" sortKey="kras" sort={sort} onSort={toggleSort} />
                  <JdSortHead label="Competencies" sortKey="competencies" sort={sort} onSort={toggleSort} />
                  <DashboardTableHead>Actions</DashboardTableHead>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <DashboardTableEmpty colSpan={7}>
                    No job descriptions yet. Create one manually or import your company JD manual (JSON
                    template or single-role .txt / .md).
                  </DashboardTableEmpty>
                ) : (
                  paged.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--dash-border-subtle)]">
                      <DashboardTableCell>
                        <Link
                          href={`/dashboard/performance/jds/${row.id}`}
                          className="font-medium text-primary-800 hover:underline"
                        >
                          {row.title}
                        </Link>
                        <div className="text-xs text-[var(--dash-text-muted)]">v{row.version}</div>
                      </DashboardTableCell>
                      <DashboardTableCell>{row.divisionName ?? '—'}</DashboardTableCell>
                      <DashboardTableCell>{row.grade ?? '—'}</DashboardTableCell>
                      <DashboardTableCell>
                        <span className={dashStatusChip(statusTone(row.status))}>{row.status}</span>
                      </DashboardTableCell>
                      <DashboardTableCell numeric>{row.kraCount}</DashboardTableCell>
                      <DashboardTableCell numeric>{row.competencyCount}</DashboardTableCell>
                      <DashboardTableCell>
                        <DashboardTableActions>
                          <Link
                            href={`/dashboard/performance/jds/${row.id}`}
                            className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                          >
                            {row.status === 'draft' ? 'Edit' : 'View'}
                          </Link>
                          <DashboardTableActionButton
                            disabled={pdfBusyId === row.id}
                            onClick={() => void exportPdf(row.id)}
                          >
                            {pdfBusyId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                            PDF
                          </DashboardTableActionButton>
                        </DashboardTableActions>
                      </DashboardTableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </DashboardTable>
          )}
        </DashboardTableViewport>
        {!loading && filtered.length > 0 ? (
          <DashboardTableFooter>
            <span>
              {filtered.length} job description{filtered.length === 1 ? '' : 's'}
            </span>
            {pageCount > 1 ? (
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs disabled:opacity-40"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="text-xs tabular-nums">
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= pageCount}
                  className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs disabled:opacity-40"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                </button>
              </div>
            ) : null}
          </DashboardTableFooter>
        ) : null}
      </DashboardTableCard>
    </DashboardPage>
  );
}

function JdSortHead({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <DashboardTableHead>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-[var(--dash-text-strong)] ${
          active ? 'text-[var(--dash-text-strong)]' : ''
        }`}
      >
        {label}
        {active ? (
          sort.dir === 'asc' ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          )
        ) : null}
      </button>
    </DashboardTableHead>
  );
}
