'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Upload } from 'lucide-react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssStatusPill } from '@/components/ess/EssStatusPill';
import { toast } from '@/components/ui/toast';
import {
  EssAlert,
  EssCard,
  EssLoadingState,
  essPrimaryButtonClass,
  essSecondaryButtonClass,
} from '@/components/ess/EssUi';

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  isRequired: boolean;
  category: string | null;
  notes: string | null;
  documentId: string | null;
  document: { id: string; fileName: string; title: string } | null;
  overdue: boolean;
  needsEvidence: boolean;
  workflow: {
    id: string;
    type: string;
    status: string;
    templateName: string;
  };
};

export default function EssOnboardingTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const fileRef = useRef<HTMLInputElement>(null);

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<'upload' | 'complete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    const res = await fetch(`/api/ess/onboarding/tasks/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTask(null);
      setError(data.error || 'Task not found.');
      return;
    }
    setTask(data as TaskDetail);
    setNotes(typeof data.notes === 'string' ? data.notes : '');
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  async function uploadFile(file: File) {
    if (!navigator.onLine) {
      toast.error('You are offline. Reconnect before uploading.');
      return;
    }
    setBusy('upload');
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/ess/onboarding/tasks/${id}/attachments`, {
        method: 'POST',
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Upload failed.');
      toast.success('Document uploaded.');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Upload failed.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function complete() {
    if (!task) return;
    if (!navigator.onLine) {
      toast.error('You are offline. Reconnect before updating onboarding tasks.');
      return;
    }
    if (task.needsEvidence) {
      setError('Attach a PDF before completing this Documents task.');
      toast.error('Attach a PDF before completing this Documents task.');
      return;
    }
    setBusy('complete');
    setError(null);
    try {
      const res = await fetch(`/api/ess/onboarding/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED', notes }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not update task.');
      toast.success('Task marked complete.');
      await load();
      router.push('/ess/onboarding');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not update task.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <EssPageHeader title="Task" subtitle="Loading…" backHref="/ess/onboarding" />
        <EssLoadingState label="Loading task…" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-4">
        <EssPageHeader title="Task" subtitle="Not found" backHref="/ess/onboarding" />
        <EssAlert tone="danger">{error || 'Task not found.'}</EssAlert>
      </div>
    );
  }

  const open = task.status !== 'COMPLETED' && task.status !== 'SKIPPED';

  return (
    <div className="space-y-4">
      <EssPageHeader
        title={task.title}
        subtitle={task.workflow.templateName}
        backHref="/ess/onboarding"
      />

      {error ? <EssAlert tone="danger">{error}</EssAlert> : null}

      <EssCard className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <EssStatusPill status={task.status.toLowerCase()} />
          {task.overdue ? (
            <span className="text-xs font-semibold uppercase text-red-600">Overdue</span>
          ) : null}
        </div>
        {task.description ? (
          <p className="text-sm leading-6 text-[var(--ess-muted)]">{task.description}</p>
        ) : null}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--ess-subtle)]">
              Due
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--ess-text)]">
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--ess-subtle)]">
              Category
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--ess-text)]">{task.category || 'General'}</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--ess-subtle)]">
              Required
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--ess-text)]">{task.isRequired ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--ess-subtle)]">
              Workflow
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--ess-text)]">{task.workflow.type}</dd>
          </div>
        </dl>
      </EssCard>

      <EssCard className="space-y-3">
        <h2 className="text-sm font-bold text-[var(--ess-text)]">Evidence</h2>
        {task.document ? (
          <p className="text-sm text-emerald-700">Uploaded: {task.document.fileName}</p>
        ) : (
          <p className="text-sm text-[var(--ess-muted)]">
            {task.needsEvidence
              ? 'A PDF is required before you can mark this Documents task complete.'
              : 'Optional. Upload a PDF if HR asked for supporting documents.'}
          </p>
        )}
        {open ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
            <button
              type="button"
              disabled={busy === 'upload'}
              onClick={() => fileRef.current?.click()}
              className={`${essSecondaryButtonClass} inline-flex w-full items-center justify-center gap-2`}
            >
              {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {task.document ? 'Replace PDF' : 'Upload PDF'}
            </button>
          </>
        ) : null}
      </EssCard>

      {open ? (
        <EssCard className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-[var(--ess-text)]">Notes</span>
            <textarea
              className="min-h-[88px] w-full rounded-2xl border border-[var(--ess-border)] bg-[var(--ess-surface)] px-3 py-2 text-sm text-[var(--ess-text)]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for HR"
            />
          </label>
          <button
            type="button"
            disabled={busy === 'complete' || task.needsEvidence}
            onClick={() => void complete()}
            className={`${essPrimaryButtonClass} inline-flex w-full items-center justify-center gap-2 disabled:opacity-50`}
          >
            {busy === 'complete' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Mark complete
          </button>
          {task.needsEvidence ? (
            <p className="text-xs text-amber-700">Upload evidence before completing.</p>
          ) : null}
        </EssCard>
      ) : (
        <EssAlert tone="success">This task is already complete.</EssAlert>
      )}
    </div>
  );
}
