'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Download, Loader2, Plus, Upload, X } from 'lucide-react';

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
import { isPublicDemoMode } from '@/lib/deployment-flags';
import { jdManualImportTemplateJson } from '@/lib/performance/jd/jd-manual-import';
import type { JobDescriptionDto, JobDescriptionInput } from '@/lib/performance/jd/types';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';

function statusClass(status: string) {
  if (status === 'published') return 'bg-emerald-100 text-emerald-800';
  if (status === 'archived') return 'bg-zinc-100 text-zinc-600';
  return 'bg-amber-100 text-amber-900';
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
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.grade ?? '').toLowerCase().includes(q) ||
        (r.divisionName ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

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
        description="Manual JD entry is the default — structured 10-section roles, KRAs, KPIs, and competencies. Import your company's JD manual (JSON) or a single role document (.txt / .md). No data leaves your tenant unless you enable AI parsing in Company Setup."
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
                    No job descriptions yet. Create one manually or import your company JD manual (JSON
                    template or single-role .txt / .md).
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
