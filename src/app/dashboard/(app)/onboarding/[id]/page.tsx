'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { deriveOffboardingCheckpointState } from '@/lib/onboarding-checkpoints';

function taskStatusTone(status: string): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'OVERDUE') return 'danger';
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'SKIPPED') return 'neutral';
  return 'warning';
}

type WorkflowDetail = {
  id: string;
  type: 'ONBOARDING' | 'OFFBOARDING';
  status: string;
  startedAt: string;
  employee: { firstName: string; lastName: string; department?: { name: string | null } | null };
  tasks: Array<{
    id: string;
    title: string;
    description?: string | null;
    assignedRole: string;
    category?: string | null;
    dueDate?: string | null;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'OVERDUE';
    isRequired: boolean;
    notes?: string | null;
  }>;
};

export default function OnboardingDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<WorkflowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [taskError, setTaskError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
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

  const grouped = useMemo(() => {
    const source = data?.tasks ?? [];
    return source.reduce<Record<string, WorkflowDetail['tasks']>>((acc, task) => {
      const key = (task.category || 'Other').toUpperCase();
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {});
  }, [data?.tasks]);

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
          data.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            category: t.category ?? null,
            status: t.status,
            isRequired: t.isRequired,
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            order: 0,
          })),
        )
      : null;

  if (loading) {
    return (
      <DashboardPage>
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workflow…
        </div>
      </DashboardPage>
    );
  }

  if (!data) {
    return (
      <DashboardPage>
        <div className="dashboard-surface p-6 text-sm text-neutral-600">
          Workflow not found.{' '}
          <Link href="/dashboard/onboarding" className="text-primary-700 hover:underline">
            Back to onboarding
          </Link>
        </div>
      </DashboardPage>
    );
  }

  const completed = data.tasks.filter((task) => task.status === 'COMPLETED').length;
  const overdue = data.tasks.filter(
    (task) =>
      task.status === 'OVERDUE' ||
      (task.status === 'PENDING' && task.dueDate && new Date(task.dueDate) < new Date()),
  ).length;
  const progress = data.tasks.length ? Math.round((completed / data.tasks.length) * 100) : 0;

  return (
    <DashboardPage>
      <Link
        href="/dashboard/onboarding"
        className="mb-3 inline-flex items-center gap-1 text-sm text-primary-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        All workflows
      </Link>

      <DashboardPageHeader
        title={`${data.employee.firstName} ${data.employee.lastName}`}
        description={`${data.employee.department?.name ?? 'No department'} · ${data.type.replace('_', ' ')} · ${data.status.replace('_', ' ')}`}
        meta={`${completed}/${data.tasks.length} complete${overdue > 0 ? ` · ${overdue} overdue` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
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
                Cancel workflow
              </button>
            ) : null}
          </div>
        }
      />

      {checkpoints ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Object.entries(checkpoints).map(([key, state]) => (
            <div key={key} className={`rounded-lg border px-3 py-2 text-xs ${state.satisfied ? 'border-emerald-200 bg-emerald-50' : state.present ? 'border-amber-200 bg-amber-50' : 'border-neutral-200 bg-neutral-50'}`}>
              <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
              <p className="text-neutral-600">{!state.present ? 'N/A' : state.satisfied ? 'Done' : 'Pending'}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-4 h-2 rounded-full bg-neutral-200">
        <div className="h-2 rounded-full bg-primary-600 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {taskError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {taskError}
        </div>
      ) : null}

      <div className="space-y-4">
        {Object.entries(grouped).map(([category, tasks]) => (
          <div key={category} className="dashboard-surface shadow-sm p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">{category}</h2>
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-neutral-200/80 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-neutral-900">{task.title}</p>
                      {task.description ? (
                        <p className="mt-0.5 text-xs text-neutral-500">{task.description}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-neutral-500">
                        {task.assignedRole}
                        {task.dueDate ? ` · due ${task.dueDate.slice(0, 10)}` : ''}
                        {task.isRequired ? ' · required' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={dashStatusChip(taskStatusTone(task.status))}>
                        {task.status.replace('_', ' ')}
                      </span>
                      {task.status !== 'COMPLETED' && task.status !== 'SKIPPED' ? (
                        <>
                          <button
                            type="button"
                            disabled={busyTaskId === task.id}
                            className="btn-primary px-2 py-1 text-xs disabled:opacity-50"
                            onClick={() => void updateTask(task.id, 'COMPLETED')}
                          >
                            Complete
                          </button>
                          {!task.isRequired ? (
                            <button
                              type="button"
                              disabled={busyTaskId === task.id}
                              className="btn-secondary px-2 py-1 text-xs disabled:opacity-50"
                              onClick={() => void updateTask(task.id, 'SKIPPED')}
                            >
                              Skip
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                  <textarea
                    className="mt-2 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                    placeholder="Add notes"
                    value={notes[task.id] ?? task.notes ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DashboardPage>
  );
}
