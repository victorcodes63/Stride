'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Circle, ClipboardList, Loader2 } from 'lucide-react';
import type { StaffTask } from '@/components/staff-tasks/types';
import {
  formatDue,
  isDueToday,
  isOverdue,
  sortTasksForDisplay,
} from '@/components/staff-tasks/task-utils';
import { staffTaskPriorityRank } from '@/lib/staff-task-api';

type TaskCounts = {
  open: number;
  overdue: number;
  today: number;
  upcoming: number;
  noDate: number;
};

function computeCounts(tasks: StaffTask[]): TaskCounts {
  const active = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
  let overdue = 0;
  let today = 0;
  let upcoming = 0;
  let noDate = 0;
  for (const task of active) {
    if (!task.dueAt) {
      noDate += 1;
    } else if (isOverdue(task)) {
      overdue += 1;
    } else if (isDueToday(task)) {
      today += 1;
    } else {
      upcoming += 1;
    }
  }
  return { open: active.length, overdue, today, upcoming, noDate };
}

function priorityDotClass(priority: StaffTask['priority']) {
  if (priority === 'high') return 'bg-rose-500';
  if (priority === 'medium') return 'bg-amber-500';
  if (priority === 'low') return 'bg-sky-500';
  return null;
}

function dueTone(task: StaffTask) {
  if (isOverdue(task)) return 'text-rose-700 dark:text-rose-300';
  if (isDueToday(task)) return 'text-[var(--stride-coral)]';
  return 'text-[var(--dash-text-muted)]';
}

export function MyTasksCountsCard() {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff/tasks?scope=assigned_to_me&status=active', {
        credentials: 'include',
        signal,
      });
      if (!res.ok) throw new Error('Failed to load tasks');
      const data = (await res.json()) as StaffTask[];
      setTasks(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setTasks([]);
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const counts = useMemo(() => computeCounts(tasks), [tasks]);

  const preview = useMemo(() => {
    const active = tasks.filter((t) => t.status !== 'done');
    return sortTasksForDisplay(active)
      .sort((a, b) => {
        const urgency =
          (isOverdue(a) ? 0 : isDueToday(a) ? 1 : 2) - (isOverdue(b) ? 0 : isDueToday(b) ? 1 : 2);
        if (urgency !== 0) return urgency;
        return staffTaskPriorityRank(b.priority) - staffTaskPriorityRank(a.priority);
      })
      .slice(0, 5);
  }, [tasks]);

  const toggleComplete = async (task: StaffTask) => {
    if (busyId) return;
    setBusyId(task.id);
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      const res = await fetch(`/api/staff/tasks/${task.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = (await res.json()) as StaffTask;
      setTasks((prev) =>
        nextStatus === 'done'
          ? prev.filter((t) => t.id !== task.id)
          : prev.map((t) => (t.id === task.id ? updated : t)),
      );
    } catch {
      // keep list as-is; user can retry from My tasks
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-solid)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--dash-border-subtle)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="dash-icon-well flex h-8 w-8 items-center justify-center rounded-lg">
              <ClipboardList className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">My tasks</h3>
              <p className="text-[11px] text-[var(--dash-text-muted)]">Assigned to you</p>
            </div>
          </div>
        </div>
        <Link
          href="/dashboard/my-tasks"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-800 dark:text-primary-400"
        >
          Open <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-1.5 border-b border-[var(--dash-border-subtle)] px-3 py-2.5 sm:px-4">
        {(
          [
            { key: 'open', label: 'Open', value: counts.open, tone: 'text-[var(--dash-text-strong)]' },
            {
              key: 'overdue',
              label: 'Overdue',
              value: counts.overdue,
              tone: counts.overdue > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-[var(--dash-text-muted)]',
            },
            {
              key: 'today',
              label: 'Today',
              value: counts.today,
              tone: counts.today > 0 ? 'text-[var(--stride-coral)]' : 'text-[var(--dash-text-muted)]',
            },
            {
              key: 'upcoming',
              label: 'Soon',
              value: counts.upcoming,
              tone: 'text-[var(--dash-text-muted)]',
            },
          ] as const
        ).map((stat) => (
          <div
            key={stat.key}
            className="rounded-lg bg-[var(--dash-surface-muted)]/70 px-2 py-1.5 text-center"
          >
            <p className={`text-base font-semibold tabular-nums leading-none ${stat.tone}`}>
              {loading ? '—' : stat.value}
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--dash-text-subtle)]">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-2 py-1.5 sm:px-3">
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-8 text-sm text-[var(--dash-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-8 text-center">
            <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs font-medium text-primary-700 hover:underline dark:text-primary-400"
            >
              Retry
            </button>
          </div>
        ) : preview.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-3 py-8 text-center">
            <p className="text-sm font-medium text-[var(--dash-text-strong)]">You&apos;re clear</p>
            <p className="mt-1 text-xs text-[var(--dash-text-muted)]">No open tasks assigned to you.</p>
            <Link
              href="/dashboard/my-tasks"
              className="mt-3 text-xs font-medium text-primary-700 hover:underline dark:text-primary-400"
            >
              Create a task →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--dash-border-subtle)]">
            {preview.map((task) => {
              const dot = priorityDotClass(task.priority);
              const overdue = isOverdue(task);
              const dueToday = isDueToday(task);
              return (
                <li key={task.id}>
                  <div className="group flex items-center gap-2 rounded-lg px-1.5 py-2 transition hover:bg-[var(--dash-hover)]">
                    <button
                      type="button"
                      disabled={busyId === task.id}
                      onClick={() => void toggleComplete(task)}
                      className="shrink-0 rounded-full p-0.5 text-[var(--dash-text-faint)] transition hover:text-primary-700 disabled:opacity-40"
                      aria-label="Mark complete"
                    >
                      {busyId === task.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                      ) : (
                        <Circle className="h-4 w-4" strokeWidth={1.75} />
                      )}
                    </button>
                    <Link
                      href={`/dashboard/my-tasks?task=${encodeURIComponent(task.id)}`}
                      className="min-w-0 flex-1"
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        {dot ? (
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
                        ) : null}
                        <p className="truncate text-sm font-medium text-[var(--dash-text-strong)]">
                          {task.title}
                        </p>
                        {task.status === 'in_progress' ? (
                          <span className="shrink-0 rounded-md bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-800 dark:bg-primary-950/40 dark:text-primary-300">
                            Doing
                          </span>
                        ) : null}
                      </div>
                      <div className={`mt-0.5 flex items-center gap-1.5 text-[11px] tabular-nums ${dueTone(task)}`}>
                        {task.dueAt ? formatDue(task.dueAt) : 'No due date'}
                        {overdue ? (
                          <span className="rounded bg-rose-100 px-1 py-px text-[10px] font-bold uppercase tracking-wide text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                            Overdue
                          </span>
                        ) : dueToday ? (
                          <span className="rounded bg-[rgba(var(--stride-coral-rgb),0.15)] px-1 py-px text-[10px] font-bold uppercase tracking-wide text-[var(--stride-coral)]">
                            Today
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!loading && !error && counts.open > preview.length ? (
        <div className="border-t border-[var(--dash-border-subtle)] px-4 py-2">
          <Link
            href="/dashboard/my-tasks"
            className="text-[11px] font-medium text-[var(--dash-text-muted)] hover:text-primary-700 dark:hover:text-primary-400"
          >
            +{counts.open - preview.length} more open task{counts.open - preview.length === 1 ? '' : 's'}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
