'use client';

import { useMemo, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';

type Props = {
  clientId: string;
  onClose: () => void;
  onImported: (summary: { created: number; skipped: number }) => void;
};

type ParsedRow = { name: string; code?: string | null; description?: string | null };

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // Skip a header row if the first cell looks like a column title.
  const firstCell = (lines[0].split(',')[0] || '').trim().toLowerCase();
  const startIndex = firstCell === 'name' || firstCell === 'department' ? 1 : 0;

  const rows: ParsedRow[] = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const cells = lines[i].split(',').map((c) => c.trim());
    const name = cells[0];
    if (!name) continue;
    rows.push({
      name,
      code: cells[1] || null,
      description: cells[2] || null,
    });
  }
  return rows;
}

export function DepartmentImportModal({ clientId, onClose, onImported }: Props) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => parseCsv(text), [text]);

  function handleFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  async function handleImport() {
    if (rows.length === 0) {
      setError('Add at least one department (one per line: name, code, description).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/outsourcing/clients/${clientId}/departments/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Import failed.');
      onImported({ created: data.created ?? 0, skipped: data.skipped ?? 0 });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="department-import-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--dash-border)] px-5 py-4">
          <div>
            <h2 id="department-import-title" className="text-lg font-semibold text-[var(--dash-text)]">
              Import departments
            </h2>
            <p className="mt-0.5 text-sm text-[var(--dash-text-muted)]">
              One per line as <code className="font-mono text-xs">name, code, description</code>. Code and description
              are optional. Duplicate names are skipped.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
              {error}
            </div>
          ) : null}

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-4 py-3 text-sm text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]">
            <Upload className="h-4 w-4" />
            <span>Upload a .csv file</span>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Finance, FIN, Handles payroll\nOperations, OPS\nWarehouse'}
            className="min-h-[160px] w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 font-mono text-sm"
          />

          <p className="text-xs text-[var(--dash-text-muted)]">
            {rows.length > 0 ? (
              <>
                <span className="font-medium tabular-nums text-[var(--dash-text)]">{rows.length}</span> department
                {rows.length !== 1 ? 's' : ''} ready to import.
              </>
            ) : (
              'Nothing to import yet.'
            )}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--dash-border)] px-5 py-3">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={saving || rows.length === 0}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Import {rows.length > 0 ? `${rows.length}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
