'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Loader2, AlertCircle } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  project?: { id: string; projectCode: string; name: string };
  assignee: { id: string; name: string } | null;
};

const COLUMNS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
] as const;

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-neutral-300',
};

export default function ProjectBoardContent() {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = projectFilter ? `?projectId=${encodeURIComponent(projectFilter)}` : '';
    fetch(`/api/projects/tasks${q}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        return data;
      })
      .then((data) => setTasks(data.tasks ?? []))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setTasks([]);
      })
      .finally(() => setLoading(false));
  }, [projectFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const projects = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const t of tasks ?? []) {
      if (t.project) map.set(t.project.id, { id: t.project.id, label: `${t.project.projectCode} — ${t.project.name}` });
    }
    return [...map.values()];
  }, [tasks]);

  async function moveTask(id: string, status: string) {
    setActing(id);
    try {
      const r = await fetch(`/api/projects/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Update failed');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setActing(null);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Project board"
        description="Kanban view across active projects — drag status via the column actions."
        icon={LayoutGrid}
      />

      {projects.length > 0 ? (
        <div className="mb-4">
          <label className="text-sm text-[var(--dash-text-muted)]">
            Filter by project{' '}
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="dash-auth-input ml-2 inline-block w-auto min-w-[14rem]"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--dash-text-muted)]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading board…
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-5">
          {COLUMNS.map((col) => {
            const colTasks = (tasks ?? []).filter((t) => t.status === col.key);
            return (
              <section
                key={col.key}
                className="flex min-h-[20rem] flex-col rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)]"
              >
                <header className="border-b border-[var(--dash-border)] px-3 py-2 text-sm font-semibold text-[var(--dash-text-strong)]">
                  {col.label}
                  <span className="ml-2 text-xs font-normal text-[var(--dash-text-muted)]">({colTasks.length})</span>
                </header>
                <ul className="flex flex-1 flex-col gap-2 p-2">
                  {colTasks.length === 0 ? (
                    <li className="py-6 text-center text-xs text-[var(--dash-text-muted)]">No tasks</li>
                  ) : (
                    colTasks.map((task) => (
                      <li
                        key={task.id}
                        className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3 shadow-sm"
                      >
                        <div className="mb-1 flex items-start gap-2">
                          <span
                            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium}`}
                            aria-hidden
                          />
                          <p className="text-sm font-medium text-[var(--dash-text-strong)]">{task.title}</p>
                        </div>
                        {task.project ? (
                          <p className="mb-2 text-xs text-[var(--dash-text-muted)]">{task.project.projectCode}</p>
                        ) : null}
                        <p className="mb-2 text-xs text-[var(--dash-text-muted)]">
                          {task.assignee?.name ?? 'Unassigned'}
                          {task.dueDate ? ` · due ${task.dueDate}` : ''}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {COLUMNS.filter((c) => c.key !== task.status).map((c) => (
                            <button
                              key={c.key}
                              type="button"
                              disabled={acting === task.id}
                              onClick={() => moveTask(task.id, c.key)}
                              className="rounded border border-[var(--dash-border)] px-1.5 py-0.5 text-[10px] text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
                            >
                              → {c.label}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </DashboardPage>
  );
}
