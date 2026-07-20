'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Upload,
} from 'lucide-react';
import { dashStatusChip, type DashStatusTone } from '@/lib/dashboard-status-chips';
import { TaskAvatar } from '@/components/onboarding/TaskAvatar';
import { TaskTypeBadge, type TaskType } from '@/components/onboarding/TaskTypeBadge';

export type TimelineTask = {
  id: string;
  title: string;
  description?: string | null;
  assignedRole: string;
  category?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'OVERDUE';
  isRequired: boolean;
  notes?: string | null;
  documentId?: string | null;
  assignedTo?: { id: string; name: string; email: string } | null;
  document?: { id: string; fileName: string; title: string } | null;
  taskType: TaskType;
  formTemplate?: { id: string; name: string } | null;
  formSubmission?: { id: string; status: string; submittedAt?: string | null } | null;
  signatureRequest?: {
    id: string;
    status: string;
    documentTitle?: string | null;
    signedAt?: string | null;
  } | null;
};

function taskStatusTone(status: TimelineTask['status']): DashStatusTone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'OVERDUE') return 'danger';
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'SKIPPED') return 'neutral';
  return 'warning';
}

const DOT_COLOR: Record<DashStatusTone, string> = {
  success: 'var(--swatch-emerald-accent)',
  danger: 'var(--swatch-rose-accent)',
  info: 'var(--swatch-sky-accent)',
  warning: 'var(--swatch-amber-accent)',
  neutral: 'var(--dash-text-subtle)',
  primary: 'var(--swatch-coral-accent)',
};

function genericStatusTone(status: string): DashStatusTone {
  const s = status.toUpperCase();
  if (/(SIGN|APPROV|COMPLET|DONE)/.test(s)) return 'success';
  if (/(REJECT|DECLIN|CANCEL|EXPIRE|FAIL)/.test(s)) return 'danger';
  if (/(SUBMIT|SENT|REVIEW)/.test(s)) return 'info';
  if (/(PEND|AWAIT|DRAFT|PROGRESS)/.test(s)) return 'warning';
  return 'neutral';
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function isTaskOverdue(task: TimelineTask): boolean {
  if (task.status === 'COMPLETED' || task.status === 'SKIPPED') return false;
  if (task.status === 'OVERDUE') return true;
  return Boolean(task.dueDate && new Date(task.dueDate) < new Date());
}

function phaseLabel(category: string): string {
  return category
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export type WorkflowTimelineProps = {
  tasks: TimelineTask[];
  notes: Record<string, string>;
  onNoteChange: (taskId: string, value: string) => void;
  onUpdate: (taskId: string, status: string) => void;
  onUpload: (taskId: string, file: File) => void;
  busyTaskId: string | null;
  uploadingTaskId: string | null;
  readOnly?: boolean;
  formSubmissionHref: (submissionId: string) => string;
  signatureHref: (signatureId: string) => string;
};

export function WorkflowTimeline({
  tasks,
  notes,
  onNoteChange,
  onUpdate,
  onUpload,
  busyTaskId,
  uploadingTaskId,
  readOnly = false,
  formSubmissionHref,
  signatureHref,
}: WorkflowTimelineProps) {
  const phases = useMemo(() => {
    const map = new Map<string, TimelineTask[]>();
    for (const task of tasks) {
      const key = (task.category || 'Other').toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return Array.from(map.entries()).map(([key, phaseTasks]) => {
      const done = phaseTasks.filter(
        (t) => t.status === 'COMPLETED' || t.status === 'SKIPPED',
      ).length;
      return { key, label: phaseLabel(key), tasks: phaseTasks, done, total: phaseTasks.length };
    });
  }, [tasks]);

  return (
    <div className="space-y-4">
      {phases.map((phase, phaseIndex) => {
        const complete = phase.done === phase.total;
        return (
          <section key={phase.key} className="dashboard-surface shadow-sm p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: complete
                      ? 'color-mix(in srgb, var(--swatch-emerald-accent) 18%, transparent)'
                      : 'var(--dash-surface-muted)',
                    color: complete ? 'var(--swatch-emerald-fg)' : 'var(--dash-text-muted)',
                  }}
                  aria-hidden
                >
                  {complete ? <CheckCircle2 className="h-4 w-4" /> : phaseIndex + 1}
                </span>
                <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">
                  {phase.label}
                </h2>
              </div>
              <span className="text-xs font-medium tabular-nums text-[var(--dash-text-muted)]">
                {phase.done}/{phase.total} done
              </span>
            </div>

            <ol className="relative">
              <span
                className="pointer-events-none absolute bottom-3 left-[11px] top-3 w-px bg-[var(--dash-border)]"
                aria-hidden
              />
              {phase.tasks.map((task) => (
                <li key={task.id} className="relative mb-3 pl-8 last:mb-0">
                  <span
                    className="absolute left-0 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full ring-4 ring-[var(--dash-surface-solid)]"
                    style={{
                      background: `color-mix(in srgb, ${DOT_COLOR[taskStatusTone(task.status)]} 16%, transparent)`,
                    }}
                    aria-hidden
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: DOT_COLOR[taskStatusTone(task.status)] }}
                    />
                  </span>
                  <TaskNode
                    task={task}
                    notes={notes}
                    onNoteChange={onNoteChange}
                    onUpdate={onUpdate}
                    onUpload={onUpload}
                    busyTaskId={busyTaskId}
                    uploadingTaskId={uploadingTaskId}
                    readOnly={readOnly}
                    formSubmissionHref={formSubmissionHref}
                    signatureHref={signatureHref}
                  />
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function TaskNode({
  task,
  notes,
  onNoteChange,
  onUpdate,
  onUpload,
  busyTaskId,
  uploadingTaskId,
  readOnly,
  formSubmissionHref,
  signatureHref,
}: {
  task: TimelineTask;
  notes: Record<string, string>;
  onNoteChange: (taskId: string, value: string) => void;
  onUpdate: (taskId: string, status: string) => void;
  onUpload: (taskId: string, file: File) => void;
  busyTaskId: string | null;
  uploadingTaskId: string | null;
  readOnly: boolean;
  formSubmissionHref: (submissionId: string) => string;
  signatureHref: (signatureId: string) => string;
}) {
  const open = task.status !== 'COMPLETED' && task.status !== 'SKIPPED';
  const isDocuments = (task.category ?? '').toLowerCase() === 'documents';
  const showUpload = open && !readOnly && (task.taskType === 'DOCUMENT' || isDocuments);
  const overdue = isTaskOverdue(task);
  const busy = busyTaskId === task.id;

  return (
    <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3 sm:p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-medium text-[var(--dash-text-strong)]">{task.title}</p>
            <TaskTypeBadge type={task.taskType} />
            {task.isRequired ? (
              <span className="rounded-full bg-[var(--dash-surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                Required
              </span>
            ) : null}
          </div>
          {task.description ? (
            <p className="mt-0.5 text-xs text-[var(--dash-text-muted)]">{task.description}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--dash-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              {task.assignedTo?.name ? (
                <>
                  <TaskAvatar name={task.assignedTo.name} size="sm" />
                  {task.assignedTo.name}
                </>
              ) : (
                <span className="text-[var(--dash-text-subtle)]">Role pool · {task.assignedRole}</span>
              )}
            </span>
            {task.dueDate ? (
              <span className={overdue ? 'font-medium text-[var(--swatch-rose-fg)]' : ''}>
                {overdue ? 'Overdue · ' : 'Due '}
                {task.dueDate.slice(0, 10)}
              </span>
            ) : null}
          </div>

          <TaskTypePanel
            task={task}
            open={open}
            isDocuments={isDocuments}
            formSubmissionHref={formSubmissionHref}
            signatureHref={signatureHref}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={dashStatusChip(taskStatusTone(task.status))}>
            {humanize(task.status)}
          </span>
          {showUpload ? (
            <label className="btn-secondary inline-flex cursor-pointer items-center gap-1 px-2 py-1 text-xs">
              {uploadingTaskId === task.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              Upload
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={uploadingTaskId === task.id}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(task.id, file);
                  e.target.value = '';
                }}
              />
            </label>
          ) : null}
          {open && !readOnly ? (
            <>
              <button
                type="button"
                disabled={busy}
                className="btn-primary px-2 py-1 text-xs disabled:opacity-50"
                onClick={() => onUpdate(task.id, 'COMPLETED')}
              >
                Complete
              </button>
              {!task.isRequired ? (
                <button
                  type="button"
                  disabled={busy}
                  className="btn-secondary px-2 py-1 text-xs disabled:opacity-50"
                  onClick={() => onUpdate(task.id, 'SKIPPED')}
                >
                  Skip
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {!readOnly ? (
        <textarea
          className="mt-2 w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-2 py-1.5 text-xs text-[var(--dash-text-body)] focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          placeholder="Add notes"
          value={notes[task.id] ?? task.notes ?? ''}
          onChange={(e) => onNoteChange(task.id, e.target.value)}
        />
      ) : task.notes ? (
        <p className="mt-2 rounded-lg bg-[var(--dash-surface-muted)] px-2 py-1.5 text-xs text-[var(--dash-text-body)]">
          {task.notes}
        </p>
      ) : null}
    </div>
  );
}

function TaskTypePanel({
  task,
  open,
  isDocuments,
  formSubmissionHref,
  signatureHref,
}: {
  task: TimelineTask;
  open: boolean;
  isDocuments: boolean;
  formSubmissionHref: (submissionId: string) => string;
  signatureHref: (signatureId: string) => string;
}) {
  if (task.taskType === 'DOCUMENT' || isDocuments) {
    if (task.document) {
      return (
        <p className="mt-1.5 text-xs text-[var(--swatch-emerald-fg)]">
          Evidence: {task.document.fileName}
        </p>
      );
    }
    if (open) {
      return (
        <p className="mt-1.5 text-xs text-[var(--swatch-amber-fg)]">
          Evidence required before complete
        </p>
      );
    }
    return null;
  }

  if (task.taskType === 'FORM') {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {task.formTemplate?.name ? (
          <span className="text-[var(--dash-text-muted)]">{task.formTemplate.name}</span>
        ) : null}
        {task.formSubmission ? (
          <>
            <span className={dashStatusChip(genericStatusTone(task.formSubmission.status))}>
              {humanize(task.formSubmission.status)}
            </span>
            <Link
              href={formSubmissionHref(task.formSubmission.id)}
              className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"
            >
              Review submission
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          </>
        ) : (
          <span className="text-[var(--dash-text-muted)]">Awaiting submission from employee</span>
        )}
      </div>
    );
  }

  if (task.taskType === 'SIGNATURE') {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {task.signatureRequest ? (
          <>
            <span className={dashStatusChip(genericStatusTone(task.signatureRequest.status))}>
              {humanize(task.signatureRequest.status)}
            </span>
            {task.signatureRequest.status.toUpperCase() === 'SIGNED' &&
            task.signatureRequest.signedAt ? (
              <span className="text-[var(--dash-text-muted)]">
                Signed {task.signatureRequest.signedAt.slice(0, 10)}
              </span>
            ) : null}
            <Link
              href={signatureHref(task.signatureRequest.id)}
              className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"
            >
              View signature
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          </>
        ) : (
          <span className="text-[var(--dash-text-muted)]">Signature not yet requested</span>
        )}
      </div>
    );
  }

  return null;
}
