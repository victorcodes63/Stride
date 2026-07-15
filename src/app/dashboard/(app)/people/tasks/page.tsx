'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  Search,
  UserPlus,
} from 'lucide-react';
import { CreateOnboardingTaskModal } from '@/components/onboarding/CreateOnboardingTaskModal';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';
import { dashStatusChip } from '@/lib/dashboard-status-chips';

type TaskRow = {
  id: string;
  title: string;
  status: string;
  assignedRole: string;
  startDate: string | null;
  dueDate: string | null;
  category?: string | null;
  documentId?: string | null;
  document?: { id: string; fileName: string; title: string } | null;
  assignedTo?: { id: string; name: string; email: string } | null;
  workflow: {
    id: string;
    type: string;
    employee: { id: string; firstName: string; lastName: string };
  };
};

function taskStatusTone(status: string): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'OVERDUE') return 'danger';
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'SKIPPED') return 'neutral';
  return 'warning';
}

function isOpen(task: TaskRow) {
  return !['COMPLETED', 'SKIPPED'].includes(task.status);
}

function isOverdue(task: TaskRow) {
  if (!task.dueDate || !isOpen(task)) return false;
  if (task.status === 'OVERDUE') return true;
  return new Date(task.dueDate) < new Date();
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return value.slice(0, 10);
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('PENDING,IN_PROGRESS,OVERDUE');
  const [dueFilter, setDueFilter] = useState<'all' | 'due' | 'overdue' | 'no_due'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ mine: 'true' });
      if (statusFilter) params.set('statuses', statusFilter);
      if (debouncedSearch) params.set('q', debouncedSearch);
      const res = await fetch(`/api/onboarding/tasks?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load tasks.');
      const list = Array.isArray(data) ? data : Array.isArray(data.tasks) ? data.tasks : [];
      setTasks(list);
      setCanCreate(data?.canCreate === true);
      setCurrentUserId(typeof data?.currentUserId === 'string' ? data.currentUserId : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const openTasks = useMemo(() => tasks.filter(isOpen), [tasks]);
  const dueCount = useMemo(
    () => openTasks.filter((t) => t.dueDate && !isOverdue(t)).length,
    [openTasks],
  );
  const overdueCount = useMemo(() => openTasks.filter(isOverdue).length, [openTasks]);
  const noDueCount = useMemo(() => openTasks.filter((t) => !t.dueDate).length, [openTasks]);
  const totalOpen = openTasks.length;

  const dueBarShares = useMemo(() => {
    if (totalOpen === 0) return { due: 0, overdue: 0, noDue: 0 };
    return {
      due: (dueCount / totalOpen) * 100,
      overdue: (overdueCount / totalOpen) * 100,
      noDue: (noDueCount / totalOpen) * 100,
    };
  }, [dueCount, overdueCount, noDueCount, totalOpen]);

  const visibleTasks = useMemo(() => {
    if (dueFilter === 'all') return tasks;
    if (dueFilter === 'overdue') return tasks.filter(isOverdue);
    if (dueFilter === 'no_due') return tasks.filter((t) => isOpen(t) && !t.dueDate);
    return tasks.filter((t) => isOpen(t) && t.dueDate && !isOverdue(t));
  }, [tasks, dueFilter]);

  async function completeTask(task: TaskRow) {
    if ((task.category ?? '').toLowerCase() === 'documents' && !task.documentId) {
      setError('Attach evidence on the workflow detail page before completing Documents tasks.');
      return;
    }
    setCompletingId(task.id);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not complete task.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete task.');
    } finally {
      setCompletingId(null);
    }
  }

  async function claimTask(taskId: string) {
    setClaimingId(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not claim task.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not claim task.');
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={ClipboardList}
        title="Tasks"
        description="Onboarding and offboarding tasks assigned to your role or to you personally."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/onboarding" className="btn-secondary inline-flex h-10 items-center px-3 text-sm">
              All workflows
            </Link>
            {canCreate ? (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="btn-primary inline-flex h-10 items-center gap-1.5 px-3 text-sm"
              >
                <Plus className="h-4 w-4" />
                Create a task
              </button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 max-w-sm rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">Total open tasks</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--dash-text)]">{totalOpen}</p>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-neutral-200">
          <div className="bg-teal-500 transition-all" style={{ width: `${dueBarShares.due}%` }} />
          <div className="bg-rose-400 transition-all" style={{ width: `${dueBarShares.overdue}%` }} />
          <div className="bg-neutral-400 transition-all" style={{ width: `${dueBarShares.noDue}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--dash-text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-500" /> Due {dueCount}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400" /> Overdue {overdueCount}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-neutral-400" /> No due {noDueCount}
          </span>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <DashboardTableCard>
        <DashboardTableToolbar label="Filters">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={dashboardFilterSelectClass}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Task status"
            >
              <option value="PENDING,IN_PROGRESS,OVERDUE">Pending / in progress</option>
              <option value="OVERDUE">Overdue only</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING,IN_PROGRESS,OVERDUE,COMPLETED,SKIPPED">All statuses</option>
            </select>
            <select
              className={dashboardFilterSelectClass}
              value={dueFilter}
              onChange={(e) => setDueFilter(e.target.value as typeof dueFilter)}
              aria-label="Due bucket"
            >
              <option value="all">All due buckets</option>
              <option value="due">Due</option>
              <option value="overdue">Overdue</option>
              <option value="no_due">No due date</option>
            </select>
            <label className="relative inline-flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-neutral-400" />
              <input
                className="h-9 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] py-1.5 pl-8 pr-3 text-sm"
                placeholder="Search tasks…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search tasks"
              />
            </label>
          </div>
        </DashboardTableToolbar>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tasks…
          </div>
        ) : visibleTasks.length === 0 ? (
          <DashboardTableEmpty
            icon={<ClipboardList className="h-8 w-8 text-neutral-300" aria-hidden />}
            title="There are no tasks yet"
            description="When HR starts a workflow or creates a task for your role, it will appear here."
          />
        ) : (
          <DashboardTableViewport>
            <DashboardTable>
              <thead className="bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-4 py-3">Task name</th>
                  <th className="px-4 py-3">Participant</th>
                  <th className="px-4 py-3">Belongs to</th>
                  <th className="px-4 py-3">Assignees</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Start → End</th>
                  <th className="px-4 py-3 w-36" />
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((task) => {
                  const canClaim =
                    isOpen(task) &&
                    (!task.assignedTo?.id || task.assignedTo.id !== currentUserId);
                  return (
                    <tr key={task.id} className="border-t border-neutral-100">
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">{task.title}</div>
                        {task.document ? (
                          <p className="mt-0.5 text-xs text-neutral-500">Evidence: {task.document.fileName}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/onboarding/${task.workflow.id}`}
                          className="text-primary-800 hover:underline"
                        >
                          {task.workflow.employee.firstName} {task.workflow.employee.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {task.workflow.type} · {task.assignedRole}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-700">
                        {task.assignedTo?.name ?? (
                          <span className="text-neutral-500">Role pool ({task.assignedRole})</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={dashStatusChip(taskStatusTone(task.status))}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-sm">
                        <span className={isOverdue(task) ? 'font-medium text-red-700' : ''}>
                          {formatDate(task.startDate)} → {formatDate(task.dueDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isOpen(task) ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {canClaim ? (
                              <button
                                type="button"
                                disabled={claimingId === task.id}
                                onClick={() => void claimTask(task.id)}
                                className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs disabled:opacity-50"
                              >
                                {claimingId === task.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <UserPlus className="h-3 w-3" />
                                )}
                                Claim
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={completingId === task.id}
                              onClick={() => void completeTask(task)}
                              className="btn-primary inline-flex items-center gap-1 px-2 py-1 text-xs disabled:opacity-50"
                            >
                              {completingId === task.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              Done
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DashboardTable>
          </DashboardTableViewport>
        )}
      </DashboardTableCard>

      {showCreate ? (
        <CreateOnboardingTaskModal onClose={() => setShowCreate(false)} onCreated={() => void load()} />
      ) : null}
    </DashboardPage>
  );
}
