'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ClipboardList, Loader2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { dashStatusChip, type DashStatusTone } from '@/lib/dashboard-status-chips';
import { deriveOffboardingCheckpointState } from '@/lib/onboarding-checkpoints';
import { WorkflowProgressRing, type ProgressRingTone } from '@/components/onboarding/WorkflowProgressRing';
import { WorkflowOwners, type WorkflowOwner } from '@/components/onboarding/WorkflowOwners';
import { WorkflowTimeline, type TimelineTask } from '@/components/onboarding/WorkflowTimeline';

function workflowStatusTone(status: string): DashStatusTone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'CANCELLED') return 'neutral';
  return 'info';
}

const FORM_SUBMISSION_HREF = (submissionId: string) =>
  `/dashboard/onboarding/forms/submissions/${submissionId}`;
const SIGNATURE_HREF = (signatureId: string) => `/dashboard/onboarding/signatures/${signatureId}`;

type WorkflowDetail = {
  id: string;
  type: 'ONBOARDING' | 'OFFBOARDING';
  status: string;
  startedAt: string;
  employee: { firstName: string; lastName: string; department?: { name: string | null } | null };
  tasks: TimelineTask[];
};

export default function OnboardingDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<WorkflowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [taskError, setTaskError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  async function loadWorkflow() {
    const res = await fetch(`/api/onboarding/workflows/${id}`);
    if (!res.ok) {
      setData(null);
      return;
    }
    const payload = (await res.json()) as WorkflowDetail;
    setData(payload);
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    void loadWorkflow().finally(() => setLoading(false));
  }, [id]);

  async function updateTask(taskId: string, status: string) {
    setTaskError(null);
    setBusyTaskId(taskId);
    try {
      const note = notes[taskId] ?? '';
      const res = await fetch(`/api/onboarding/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes: note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Could not update task.');
      }
      await loadWorkflow();
    } catch (e) {
      setTaskError(e instanceof Error ? e.message : 'Could not update task.');
    } finally {
      setBusyTaskId(null);
    }
  }

  async function uploadEvidence(taskId: string, file: File) {
    setTaskError(null);
    setUploadingTaskId(taskId);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/onboarding/tasks/${taskId}/attachments`, {
        method: 'POST',
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Upload failed.');
      await loadWorkflow();
    } catch (e) {
      setTaskError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploadingTaskId(null);
    }
  }

  async function cancelWorkflow() {
    if (!data || data.status === 'CANCELLED') return;
    if (!window.confirm('Cancel this workflow? Open tasks will remain but the workflow will be marked cancelled.')) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/onboarding/workflows/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not cancel workflow');
      }
      await loadWorkflow();
    } catch (e) {
      setTaskError(e instanceof Error ? e.message : 'Could not cancel workflow');
    } finally {
      setCancelling(false);
    }
  }

  const checkpoints =
    data?.type === 'OFFBOARDING'
      ? deriveOffboardingCheckpointState(
          data.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            category: task.category ?? null,
            status: task.status,
            isRequired: task.isRequired,
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            order: 0,
          })),
        )
      : null;

  const summary = useMemo(() => {
    const tasks = data?.tasks ?? [];
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'SKIPPED').length;
    const overdue = tasks.filter(
      (t) =>
        t.status !== 'COMPLETED' &&
        t.status !== 'SKIPPED' &&
        (t.status === 'OVERDUE' || (t.dueDate ? new Date(t.dueDate) < new Date() : false)),
    ).length;
    const requiredRemaining = tasks.filter(
      (t) => t.isRequired && t.status !== 'COMPLETED' && t.status !== 'SKIPPED',
    ).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const owners = new Map<string, WorkflowOwner>();
    for (const task of tasks) {
      if (task.assignedTo?.id) owners.set(task.assignedTo.id, { id: task.assignedTo.id, name: task.assignedTo.name });
    }
    return { total, done, overdue, requiredRemaining, pct, owners: Array.from(owners.values()) };
  }, [data?.tasks]);

  if (loading) {
    return (
      <DashboardPage>
        <div className="flex items-center gap-2 py-16 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workflow…
        </div>
      </DashboardPage>
    );
  }

  if (!data) {
    return (
      <DashboardPage>
        <p className="text-sm text-neutral-600">Workflow not found.</p>
        <Link href="/dashboard/onboarding" className="mt-3 inline-flex text-sm text-primary-800 hover:underline">
          Back to workflows
        </Link>
      </DashboardPage>
    );
  }

  const ringTone: ProgressRingTone =
    summary.total > 0 && summary.done === summary.total
      ? 'success'
      : summary.overdue > 0
        ? 'warning'
        : 'primary';

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={ClipboardList}
        title={`${data.type === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'} · ${data.employee.firstName} ${data.employee.lastName}`}
        description={
          data.employee.department?.name
            ? `${data.employee.department.name} · started ${data.startedAt.slice(0, 10)}`
            : `Started ${data.startedAt.slice(0, 10)}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/onboarding"
              className="btn-secondary inline-flex h-10 items-center gap-1.5 px-3 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Workflows
            </Link>
            <Link href="/dashboard/people/tasks" className="btn-secondary inline-flex h-10 items-center px-3 text-sm">
              My tasks
            </Link>
            {data.status === 'IN_PROGRESS' ? (
              <button
                type="button"
                disabled={cancelling}
                onClick={() => void cancelWorkflow()}
                className="btn-secondary inline-flex h-10 items-center px-3 text-sm text-red-700 disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel workflow'}
              </button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 dashboard-surface shadow-sm p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <WorkflowProgressRing
              value={summary.done}
              total={summary.total}
              size={76}
              tone={ringTone}
            />
            <div>
              <p className="text-2xl font-bold tabular-nums text-[var(--dash-text-strong)]">
                {summary.done}
                <span className="text-base font-medium text-[var(--dash-text-muted)]">/{summary.total}</span>
              </p>
              <p className="text-xs text-[var(--dash-text-muted)]">tasks complete</p>
              <span className={`mt-1 inline-flex ${dashStatusChip(workflowStatusTone(data.status))}`}>
                {data.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryTile
              label="Overdue"
              value={summary.overdue}
              tone={summary.overdue > 0 ? 'danger' : 'neutral'}
              icon={summary.overdue > 0}
            />
            <SummaryTile
              label="Required left"
              value={summary.requiredRemaining}
              tone={summary.requiredRemaining > 0 ? 'warning' : 'success'}
            />
            <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--dash-text-muted)]">Owners</p>
              <div className="mt-1.5">
                <WorkflowOwners owners={summary.owners} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {checkpoints ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Object.entries(checkpoints).map(([key, state]) => (
            <div
              key={key}
              className={`rounded-xl border px-3 py-2 text-xs ${
                state.satisfied
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                  : state.present
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
                    : 'border-[var(--dash-border)] bg-[var(--dash-surface-muted)]'
              }`}
            >
              <p className="font-medium capitalize text-[var(--dash-text-strong)]">{key.replace(/([A-Z])/g, ' $1')}</p>
              <p className="text-[var(--dash-text-muted)]">{!state.present ? 'N/A' : state.satisfied ? 'Done' : 'Pending'}</p>
            </div>
          ))}
        </div>
      ) : null}

      {taskError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {taskError}
        </div>
      ) : null}

      <WorkflowTimeline
        tasks={data.tasks}
        notes={notes}
        onNoteChange={(taskId, value) => setNotes((prev) => ({ ...prev, [taskId]: value }))}
        onUpdate={(taskId, status) => void updateTask(taskId, status)}
        onUpload={(taskId, file) => void uploadEvidence(taskId, file)}
        busyTaskId={busyTaskId}
        uploadingTaskId={uploadingTaskId}
        readOnly={data.status === 'CANCELLED'}
        formSubmissionHref={FORM_SUBMISSION_HREF}
        signatureHref={SIGNATURE_HREF}
      />
    </DashboardPage>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  icon = false,
}: {
  label: string;
  value: number;
  tone: 'danger' | 'warning' | 'success' | 'neutral';
  icon?: boolean;
}) {
  const toneColor: Record<'danger' | 'warning' | 'success' | 'neutral', string> = {
    danger: 'var(--swatch-rose-fg)',
    warning: 'var(--swatch-amber-fg)',
    success: 'var(--swatch-emerald-fg)',
    neutral: 'var(--dash-text-strong)',
  };
  return (
    <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--dash-text-muted)]">{label}</p>
      <p
        className="mt-1 inline-flex items-center gap-1 text-xl font-bold tabular-nums"
        style={{ color: toneColor[tone] }}
      >
        {icon ? <AlertTriangle className="h-4 w-4" aria-hidden /> : null}
        {value}
      </p>
    </div>
  );
}
