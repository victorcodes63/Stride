'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  RotateCcw,
  SkipForward,
  UserPlus,
  X,
} from 'lucide-react';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { TaskAvatar } from '@/components/onboarding/TaskAvatar';
import {
  type TaskRow,
  dueRelativeLabel,
  formatDate,
  isOpen,
  isOperational,
  isOverdue,
  participantName,
  priorityMeta,
  recurrenceLabel,
  roleLabel,
  statusLabel,
  taskEmployee,
  taskStatusTone,
  workflowTypeLabel,
} from '@/components/onboarding/task-view';

type FullTask = TaskRow;

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

type Assignee = { id: string; name: string; email: string; role?: string; staffUserType?: string | null };

type Props = {
  taskId: string;
  canManage: boolean;
  currentUserId: string | null;
  roleKeys: string[];
  onClose: () => void;
  onChanged: () => void;
};

export function TaskDetailDrawer({ taskId, canManage, currentUserId, roleKeys, onClose, onChanged }: Props) {
  const [task, setTask] = useState<FullTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/tasks/${taskId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load task.');
      setTask(data as FullTask);
      setNotes(typeof data.notes === 'string' ? data.notes : '');
      setNotesDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load task.');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/onboarding/assignees');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setAssignees(data);
      } catch {
        /* non-blocking */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const documentsCategory = (task?.category ?? '').toLowerCase() === 'documents';
  const canActOnTask = useMemo(() => {
    if (!task) return false;
    if (canManage) return true;
    if (task.assignedTo?.id && task.assignedTo.id === currentUserId) return true;
    return roleKeys.includes(task.assignedRole);
  }, [task, canManage, currentUserId, roleKeys]);

  async function mutate(action: string, body: Record<string, unknown>, successMsg: string) {
    if (!task) return;
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Action failed.');
      toast.success(successMsg);
      await load();
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Action failed.';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function complete() {
    if (!task) return;
    if (documentsCategory && !task.documentId) {
      setError('Attach evidence before completing this Documents task.');
      toast.error('Attach evidence before completing this Documents task.');
      return;
    }
    await mutate('complete', { status: 'COMPLETED' }, 'Task marked done.');
  }

  async function reassign(value: string) {
    await mutate('reassign', { assignedToId: value }, value ? 'Task reassigned.' : 'Task returned to role pool.');
  }

  async function saveNotes() {
    await mutate('notes', { notes }, 'Notes saved.');
  }

  async function remind() {
    if (!task) return;
    setBusy('remind');
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/tasks/${task.id}/remind`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send reminder.');
      toast.success(`Reminder sent to ${data.notified ?? 0} ${data.notified === 1 ? 'person' : 'people'}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not send reminder.';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function uploadEvidence(file: File) {
    if (!task) return;
    setBusy('upload');
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/onboarding/tasks/${task.id}/attachments`, { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      toast.success('Evidence attached.');
      await load();
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed.';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const open = task ? isOpen(task) : false;
  const overdue = task ? isOverdue(task) : false;
  const claimed = Boolean(task?.assignedTo?.id);
  const canClaim = task ? open && (!claimed || task.assignedTo?.id !== currentUserId) : false;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        className="relative flex h-full w-full max-w-md flex-col overflow-hidden border-l border-[var(--dash-border)] bg-[var(--dash-surface-solid)] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--dash-border)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dash-text-muted)]">
              Task details
            </p>
            {task ? (
              <h2 className="mt-0.5 truncate text-lg font-semibold text-[var(--dash-text-strong)]">{task.title}</h2>
            ) : (
              <div className="mt-1 h-5 w-40 animate-pulse rounded bg-[var(--dash-surface-muted)]" />
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--dash-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !task ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error ?? 'Task not found.'}
            </div>
          ) : (
            <div className="space-y-5">
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <span className={dashStatusChip(taskStatusTone(task.status))}>{statusLabel(task.status)}</span>
                <span className="inline-flex items-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--dash-text-body)]">
                  {workflowTypeLabel(task.workflow.type)}
                </span>
                <span className="inline-flex items-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--dash-text-body)]">
                  {roleLabel(task.assignedRole)} pool
                </span>
                {(() => {
                  const meta = priorityMeta(task.priority);
                  return (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ background: `${meta.dot}1f`, color: meta.dot }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
                      {meta.label}
                    </span>
                  );
                })()}
                {recurrenceLabel(task.recurrence) ? (
                  <span className="inline-flex items-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--dash-text-body)]">
                    ↻ {recurrenceLabel(task.recurrence)}
                  </span>
                ) : null}
                {task.isRequired ? (
                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700">
                    Required
                  </span>
                ) : null}
              </div>

              {task.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--dash-text-body)]">
                  {task.description}
                </p>
              ) : null}

              <dl className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-3 text-sm">
                <Field label={isOperational(task) ? 'Related to' : 'Participant'}>
                  {(() => {
                    const emp = taskEmployee(task);
                    if (!emp) {
                      return <span className="text-[var(--dash-text-muted)]">—</span>;
                    }
                    const name = participantName(task);
                    if (isOperational(task)) {
                      return (
                        <span className="inline-flex items-center gap-2 font-medium text-[var(--dash-text-strong)]">
                          <TaskAvatar name={name} seed={emp.id} />
                          {name}
                        </span>
                      );
                    }
                    return (
                      <Link
                        href={`/dashboard/onboarding/${task.workflow.id}`}
                        className="inline-flex items-center gap-2 font-medium text-[var(--brand-primary)] hover:underline"
                      >
                        <TaskAvatar name={name} seed={emp.id} />
                        {name}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    );
                  })()}
                </Field>
                <Field label="Assignee">
                  {task.assignedTo ? (
                    <span className="inline-flex items-center gap-2 text-[var(--dash-text-strong)]">
                      <TaskAvatar name={task.assignedTo.name} seed={task.assignedTo.id} />
                      {task.assignedTo.name}
                    </span>
                  ) : (
                    <span className="text-[var(--dash-text-muted)]">Unassigned · {roleLabel(task.assignedRole)} pool</span>
                  )}
                </Field>
                <Field label="Due">
                  <span className={overdue ? 'font-medium text-rose-600' : 'text-[var(--dash-text-strong)]'}>
                    {dueRelativeLabel(task)}
                    <span className="ml-1 text-[var(--dash-text-muted)]">({formatDate(task.dueDate)})</span>
                  </span>
                </Field>
                <Field label="Start">
                  <span className="text-[var(--dash-text-strong)]">{formatDate(task.startDate)}</span>
                </Field>
                {task.completedBy ? (
                  <Field label="Completed by">
                    <span className="text-[var(--dash-text-strong)]">
                      {task.completedBy.name} · {formatDate(task.completedAt)}
                    </span>
                  </Field>
                ) : null}
              </dl>

              {/* Reassign (HR only) */}
              {canManage ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--dash-text-muted)]">
                    Reassign
                  </p>
                  <StrideSelect
                    value={task.assignedTo?.id ?? ''}
                    onChange={(value) => void reassign(value)}
                    disabled={busy !== null}
                    options={[
                      { value: '', label: `Unassigned · ${roleLabel(task.assignedRole)} pool` },
                      ...assignees.map((a) => ({ value: a.id, label: `${a.name} (${a.email})` })),
                    ]}
                    ariaLabel="Reassign task"
                    className="w-full"
                  />
                  <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--dash-text-muted)]">
                    Priority
                  </p>
                  <StrideSelect
                    value={(task.priority ?? 'MEDIUM').toUpperCase()}
                    onChange={(value) => void mutate('priority', { priority: value }, 'Priority updated.')}
                    disabled={busy !== null}
                    options={PRIORITY_OPTIONS}
                    ariaLabel="Task priority"
                    className="w-full"
                  />
                </div>
              ) : null}

              {/* Evidence */}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--dash-text-muted)]">
                  Evidence {documentsCategory ? <span className="text-rose-600">(required to complete)</span> : null}
                </p>
                {task.document && taskEmployee(task) ? (
                  <a
                    href={`/api/outsourcing/employees/${taskEmployee(task)!.id}/documents/${task.document.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)]"
                  >
                    <FileText className="h-4 w-4 text-[var(--brand-primary)]" />
                    <span className="min-w-0 flex-1 truncate">{task.document.fileName}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-[var(--dash-text-muted)]" />
                  </a>
                ) : (
                  <p className="text-sm text-[var(--dash-text-muted)]">No evidence attached yet.</p>
                )}
                {canActOnTask ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadEvidence(file);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={busy !== null}
                      className="btn-secondary mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      {busy === 'upload' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Paperclip className="h-3.5 w-3.5" />
                      )}
                      {task.document ? 'Replace PDF' : 'Attach PDF'}
                    </button>
                  </>
                ) : null}
              </div>

              {/* Notes */}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--dash-text-muted)]">
                  Notes
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setNotesDirty(true);
                  }}
                  disabled={!canActOnTask || busy !== null}
                  placeholder={canActOnTask ? 'Add a note about this task…' : 'No notes.'}
                  className="min-h-[80px] w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm disabled:opacity-60"
                />
                {canActOnTask && notesDirty ? (
                  <button
                    type="button"
                    onClick={() => void saveNotes()}
                    disabled={busy !== null}
                    className="btn-secondary mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {busy === 'notes' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Save notes
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {task ? (
          <footer className="flex flex-wrap items-center gap-2 border-t border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-5 py-3">
            {open ? (
              <>
                {canClaim && canActOnTask ? (
                  <button
                    type="button"
                    onClick={() => void mutate('claim', { claim: true }, 'Task claimed.')}
                    disabled={busy !== null}
                    className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {busy === 'claim' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Claim
                  </button>
                ) : null}
                {(canActOnTask || canManage) ? (
                  <button
                    type="button"
                    onClick={() => void remind()}
                    disabled={busy !== null}
                    className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm disabled:opacity-50"
                    title="Send an in-app + email reminder to the assignee(s)"
                  >
                    {busy === 'remind' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                    Remind
                  </button>
                ) : null}
                {canActOnTask ? (
                  <button
                    type="button"
                    onClick={() => void mutate('skip', { status: 'SKIPPED' }, 'Task skipped.')}
                    disabled={busy !== null}
                    className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {busy === 'skip' ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />}
                    Skip
                  </button>
                ) : null}
                {canActOnTask ? (
                  <button
                    type="button"
                    onClick={() => void complete()}
                    disabled={busy !== null}
                    className="btn-primary ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {busy === 'complete' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Mark done
                  </button>
                ) : null}
              </>
            ) : canActOnTask ? (
              <button
                type="button"
                onClick={() => void mutate('reopen', { status: 'IN_PROGRESS' }, 'Task reopened.')}
                disabled={busy !== null}
                className="btn-secondary ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm disabled:opacity-50"
              >
                {busy === 'reopen' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Reopen
              </button>
            ) : null}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-xs text-[var(--dash-text-muted)]">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}
