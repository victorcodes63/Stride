'use client';

import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, UploadCloud } from 'lucide-react';
import { DashboardModal } from '@/components/dashboard/DashboardModal';
import { StrideSelect } from '@/components/ui/stride-select';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { toast } from '@/components/ui/toast';
import type { ImportPreview, StaffBiometricDevice } from './types';

type Step = 'select' | 'preview' | 'done';

type Props = {
  devices: StaffBiometricDevice[];
  defaultDeviceId?: string;
  onClose: () => void;
  onImported: () => void;
};

function directionChip(direction: 'in' | 'out' | 'unknown') {
  const tone = direction === 'in' ? 'success' : direction === 'out' ? 'info' : 'neutral';
  return <span className={dashStatusChip(tone)}>{direction}</span>;
}

export function CsvImportWizard({ devices, defaultDeviceId, onClose, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('select');
  const [deviceId, setDeviceId] = useState(defaultDeviceId ?? devices[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState<{ inserted: number; eventsCreated: number; skipped: number } | null>(
    null,
  );

  const deviceOptions = useMemo(
    () => devices.map((d) => ({ value: d.id, label: d.name })),
    [devices],
  );

  async function runPreview() {
    if (!deviceId || !file) {
      setError('Select a device and a CSV file.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('deviceId', deviceId);
      const res = await fetch('/api/staff/biometric/import/preview', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Preview failed.');
      setPreview(data as ImportPreview);
      setStep('preview');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Preview failed.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function runCommit() {
    if (!deviceId || !file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('deviceId', deviceId);
      const res = await fetch('/api/staff/biometric/import/commit', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Import failed.');
      setCommitted({ inserted: data.inserted, eventsCreated: data.eventsCreated, skipped: data.skipped });
      setStep('done');
      toast.success(`Imported ${data.inserted} punch(es).`);
      onImported();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const footer =
    step === 'select' ? (
      <>
        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void runPreview()}
          disabled={busy || !deviceId || !file}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Preview
        </button>
      </>
    ) : step === 'preview' ? (
      <>
        <button
          type="button"
          onClick={() => setStep('select')}
          disabled={busy}
          className="btn-secondary mr-auto px-4 py-2 text-sm"
        >
          Back
        </button>
        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void runCommit()}
          disabled={busy || !preview || preview.toImport === 0}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Import {preview?.toImport ?? 0} punch(es)
        </button>
      </>
    ) : (
      <button type="button" onClick={onClose} className="btn-primary px-4 py-2 text-sm">
        Done
      </button>
    );

  return (
    <DashboardModal
      open
      onClose={onClose}
      title="Import punches from CSV"
      description="Upload a punch export, preview matches, then commit."
      icon={<FileUp className="h-5 w-5" />}
      size="xl"
      dismissible={!busy}
      footer={footer}
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
          {error}
        </div>
      ) : null}

      {step === 'select' ? (
        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">Target device</span>
            <StrideSelect
              value={deviceId}
              onChange={setDeviceId}
              options={deviceOptions}
              placeholder="Select a device…"
              ariaLabel="Target device"
              className="w-full"
            />
          </label>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-4 py-8 text-center transition-colors hover:border-primary-400"
          >
            <UploadCloud className="h-8 w-8 text-neutral-400" aria-hidden />
            <span className="text-sm font-medium text-[var(--dash-text)]">
              {file ? file.name : 'Click to choose a CSV file'}
            </span>
            <span className="text-xs text-[var(--dash-text-muted)]">
              Columns: observedAt, subject, direction (in/out), externalEventId (optional)
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
        </div>
      ) : null}

      {step === 'preview' && preview ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'To import', value: preview.toImport, tone: 'text-primary-900' },
              { label: 'Matched', value: preview.matchedCount, tone: 'text-green-600' },
              { label: 'Unmatched', value: preview.unmatchedCount, tone: 'text-amber-600' },
              { label: 'Already imported', value: preview.alreadyImported, tone: 'text-neutral-500' },
            ].map((s) => (
              <div key={s.label} className="dashboard-stat-card shadow-sm">
                <div className="text-[10px] uppercase tracking-wide text-neutral-500">{s.label}</div>
                <div className={`mt-1 text-2xl font-bold tabular-nums ${s.tone}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {preview.duplicateInFile > 0 ? (
            <p className="text-xs text-[var(--dash-text-muted)]">
              {preview.duplicateInFile} duplicate row(s) within the file were collapsed by event id.
            </p>
          ) : null}

          {preview.unmatchedCount > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              {preview.unmatchedCount} punch(es) are not mapped to a staff member and will import
              unmatched. Map their subjects afterwards to backfill attendance:
              <span className="ml-1 font-mono">
                {preview.unmatchedSubjects
                  .slice(0, 6)
                  .map((s) => `${s.rawSubjectId} (${s.count})`)
                  .join(', ')}
                {preview.unmatchedSubjects.length > 6 ? '…' : ''}
              </span>
            </div>
          ) : null}

          <div className="max-h-72 overflow-auto rounded-xl border border-[var(--dash-border)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Observed</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Direction</th>
                  <th className="px-3 py-2">Matched staff</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={`${row.externalEventId}-${row.rowIndex}`} className="border-t border-neutral-100">
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                      {new Date(row.observedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs">{row.rawSubjectId}</td>
                    <td className="px-3 py-1.5">{directionChip(row.direction)}</td>
                    <td className="px-3 py-1.5">
                      {row.matchedUserName ? (
                        row.matchedUserName
                      ) : (
                        <span className="text-amber-600">Unmatched</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {row.status === 'already_imported' ? (
                        <span className={dashStatusChip('neutral')}>Skip (exists)</span>
                      ) : (
                        <span className={dashStatusChip('success')}>New</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.truncated ? (
            <p className="text-xs text-[var(--dash-text-muted)]">
              Showing first {preview.rows.length} rows of {preview.uniqueRows}.
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 'done' && committed ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600" aria-hidden />
          <p className="text-base font-semibold text-[var(--dash-text)]">Import complete</p>
          <p className="text-sm text-[var(--dash-text-muted)]">
            {committed.inserted} punch(es) added · {committed.eventsCreated} attendance event(s) created
            {committed.skipped > 0 ? ` · ${committed.skipped} skipped as duplicates` : ''}.
          </p>
        </div>
      ) : null}
    </DashboardModal>
  );
}
