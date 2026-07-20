'use client';

import { useState } from 'react';
import { ExternalLink, FileText, Link2, Loader2, Paperclip, Plus, Trash2 } from 'lucide-react';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import type { TrainingMaterialRow } from '@/lib/training/types';

type MaterialsPanelProps = {
  programId: string;
  materials: TrainingMaterialRow[];
  onRefresh: () => Promise<void> | void;
};

const inputClass =
  'h-9 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-ink placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30';

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function MaterialsPanel({ programId, materials, onRefresh }: MaterialsPanelProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [toRemove, setToRemove] = useState<TrainingMaterialRow | null>(null);
  const [removing, setRemoving] = useState(false);

  const addMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Enter a material title.');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/training/${programId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: trimmedTitle,
          externalUrl: url.trim() ? normalizeUrl(url) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add material');
      toast.success('Material added.');
      setTitle('');
      setUrl('');
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add material.');
    } finally {
      setAdding(false);
    }
  };

  const confirmRemove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/training/${programId}/materials/${toRemove.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove material');
      toast.success('Material removed.');
      setToRemove(null);
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove material.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className={`${DASHBOARD_SURFACE_CLASS} p-5 shadow-sm`}>
      <div className="mb-4 flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-primary-600" />
        <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Materials</h2>
        <span className="text-xs text-[var(--dash-text-muted)]">({materials.length})</span>
      </div>

      {materials.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--dash-border)] px-4 py-6 text-center text-sm text-[var(--dash-text-muted)]">
          No materials yet. Add links to slides, guides, or recordings below.
        </p>
      ) : (
        <ul className="space-y-2">
          {materials.map((material) => (
            <li
              key={material.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-muted)] px-3 py-2.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                {material.externalUrl ? <Link2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--dash-text-strong)]">{material.title}</p>
                {material.externalUrl ? (
                  <a
                    href={material.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 truncate text-xs text-primary-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{material.externalUrl}</span>
                  </a>
                ) : material.filePath ? (
                  <span className="truncate text-xs text-[var(--dash-text-muted)]">{material.filePath}</span>
                ) : (
                  <span className="text-xs text-[var(--dash-text-muted)]">No link</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setToRemove(material)}
                aria-label={`Remove ${material.title}`}
                className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addMaterial} className="mt-4 space-y-2 border-t border-[var(--dash-border-subtle)] pt-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Material title *"
          aria-label="Material title"
          className={inputClass}
        />
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://link-to-resource"
            aria-label="Material URL"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={adding}
            className="btn-primary inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-sm disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={Boolean(toRemove)}
        title="Remove material"
        description={toRemove ? `Remove “${toRemove.title}”? This cannot be undone.` : undefined}
        confirmLabel="Remove"
        tone="danger"
        loading={removing}
        onConfirm={confirmRemove}
        onCancel={() => (!removing ? setToRemove(null) : undefined)}
      />
    </div>
  );
}
