'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2 } from 'lucide-react';
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
  dueDate: string | null;
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

function isOverdue(task: TaskRow) {
  if (!task.dueDate || task.status === 'COMPLETED' || task.status === 'SKIPPED') return false;
  return new Date(task.dueDate) < new Date();
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ mine: 'true' });
      if (statusFilter) params.set('statuses', statusFilter);
      const res = await fetch(`/api/onboarding/tasks?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load tasks.');
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openTasks = useMemo(
    () => tasks.filter((t) => !['COMPLETED', 'SKIPPED'].includes(t.status)),
    [tasks],
  );
  const overdueCount = useMemo(() => openTasks.filter(isOverdue).length, [openTasks]);

  async function completeTask(taskId: string) {
    setCompletingId(taskId);
    try {
      const res = await fetch(`/api/onboarding/tasks/${taskId}`, {
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

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={ClipboardList}
        title="My onboarding tasks"
        description="Tasks assigned to your role across active onboarding and offboarding workflows."
        actions={
          <Link href="/dashboard/onboarding" className="btn-secondary inline-flex h-10 items-center px-3 text-sm">
            All workflows
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="dashboard-stat-card shadow-sm">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Open tasks</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary-900">{openTasks.length}</p>
        </div>
        <div className="dashboard-stat-card shadow-sm">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Overdue</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-700">{overdueCount}</p>
        </div>
        <div className="dashboard-stat-card shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Total assigned</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary-900">{tasks.length}</p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <DashboardTableCard>
        <DashboardTableToolbar label="Filters">
          <select
            className={dashboardFilterSelectClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Task status"
          >
            <option value="">Open tasks (default)</option>
            <option value="PENDING,IN_PROGRESS,OVERDUE">Pending / in progress</option>
            <option value="OVERDUE">Overdue only</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING,IN_PROGRESS,OVERDUE,COMPLETED,SKIPPED">All statuses</option>
          </select>
        </DashboardTableToolbar>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tasks…
          </div>
        ) : tasks.length === 0 ? (
          <DashboardTableEmpty
            icon={<ClipboardList className="h-8 w-8 text-neutral-300" aria-hidden />}
            title="No tasks assigned to you"
            description="When HR starts a workflow, tasks for your role will appear here."
          />
        ) : (
          <DashboardTableViewport>
            <DashboardTable>
              <thead className="bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Workflow</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-t border-neutral-100">
                    <td className="px-4 py-3 font-medium text-neutral-900">{task.title}</td>
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
                    <td className="px-4 py-3 tabular-nums text-sm">
                      {task.dueDate ? (
                        <span className={isOverdue(task) ? 'font-medium text-red-700' : ''}>
                          {task.dueDate.slice(0, 10)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={dashStatusChip(taskStatusTone(task.status))}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {task.status !== 'COMPLETED' && task.status !== 'SKIPPED' ? (
                        <button
                          type="button"
                          disabled={completingId === task.id}
                          onClick={() => void completeTask(task.id)}
                          className="btn-primary inline-flex items-center gap-1 px-2 py-1 text-xs disabled:opacity-50"
                        >
                          {completingId === task.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          Done
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
          </DashboardTableViewport>
        )}
      </DashboardTableCard>
    </DashboardPage>
  );
}
