'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Loader2, AlertCircle, Plus } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type ProjectOption = { id: string; projectCode: string; name: string };
type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  project?: ProjectOption;
  assignee: { id: string; name: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  backlog: 'bg-neutral-100 text-neutral-600',
  todo: 'bg-blue-50 text-blue-800',
  in_progress: 'bg-violet-50 text-violet-800',
  blocked: 'bg-red-50 text-red-800',
  done: 'bg-emerald-50 text-emerald-800',
};

export default function ProjectTasksContent() {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = statusFilter ? `?status=${statusFilter}` : '';
    Promise.all([
      fetch(`/api/projects/tasks${q}`).then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load tasks');
        return data;
      }),
      fetch('/api/projects').then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return { projects: [] };
        return data;
      }),
    ])
      .then(([taskData, projectData]) => {
        setTasks(taskData.tasks ?? []);
        setProjects(projectData.projects ?? []);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setTasks([]);
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!projectId && projects[0]?.id) setProjectId(projects[0].id);
  }, [projects, projectId]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/projects/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          dueDate: dueDate || undefined,
          status: 'todo',
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to create');
      setTitle('');
      setDueDate('');
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Tasks & deliverables"
        description="All project tasks across your workspace — assign owners and track completion."
        icon={ClipboardList}
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            disabled={!projects.length}
            className="btn-primary dash-panel-cta inline-flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New task
          </button>
        }
      />

      {showForm ? (
        <form
          onSubmit={createTask}
          className="mb-6 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 shadow-sm"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="dash-auth-input w-full"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Project</span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="dash-auth-input w-full"
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} — {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="dash-auth-input w-full"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={saving} className="dash-auth-submit max-w-[10rem]">
              {saving ? 'Saving…' : 'Add task'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-2 text-sm text-[var(--dash-text-muted)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {['', 'todo', 'in_progress', 'blocked', 'done'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`dash-filter-pill ${statusFilter === s ? 'dash-filter-pill--active' : ''}`}
          >
            {s ? s.replace('_', ' ') : 'All open'}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--dash-text-muted)]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading tasks…
        </div>
      ) : !tasks?.length ? (
        <p className="py-12 text-center text-sm text-[var(--dash-text-muted)]">
          {projects.length === 0
            ? 'Create a project first, then add tasks here or from the board.'
            : 'No tasks match this filter.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)]">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--dash-border)] bg-[var(--dash-surface-muted)] text-left text-[var(--dash-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-[var(--dash-border-subtle)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">{t.title}</td>
                  <td className="px-4 py-3 text-[var(--dash-text-body)]">
                    {t.project ? `${t.project.projectCode}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[t.status] ?? ''}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">{t.assignee?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--dash-text-muted)]">{t.dueDate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPage>
  );
}
