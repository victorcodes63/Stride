'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Loader2, AlertCircle, Plus, Target } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { StrideSelect } from '@/components/ui/stride-select';

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
type MilestoneRow = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  taskCount?: number;
};

const STATUS_STYLES: Record<string, string> = {
  backlog: 'bg-neutral-100 text-neutral-600',
  todo: 'bg-blue-50 text-blue-800',
  in_progress: 'bg-violet-50 text-violet-800',
  blocked: 'bg-red-50 text-red-800',
  done: 'bg-emerald-50 text-emerald-800',
  pending: 'bg-neutral-100 text-neutral-600',
};

const MILESTONE_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-neutral-100 text-neutral-600',
  in_progress: 'bg-violet-50 text-violet-800',
  done: 'bg-emerald-50 text-emerald-800',
};

export default function ProjectTasksContent() {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[] | null>(null);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [milestoneDueDate, setMilestoneDueDate] = useState('');

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

  const loadMilestones = useCallback((pid: string) => {
    if (!pid) {
      setMilestones(null);
      return;
    }
    setMilestonesLoading(true);
    fetch(`/api/projects/milestones?projectId=${encodeURIComponent(pid)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load milestones');
        return data;
      })
      .then((data) => setMilestones(data.milestones ?? []))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load milestones');
        setMilestones([]);
      })
      .finally(() => setMilestonesLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!projectId && projects[0]?.id) setProjectId(projects[0].id);
  }, [projects, projectId]);

  useEffect(() => {
    if (projectId) loadMilestones(projectId);
  }, [projectId, loadMilestones]);

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
      if (projectId) loadMilestones(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function createMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !milestoneTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/projects/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: milestoneTitle.trim(),
          description: milestoneDescription.trim() || undefined,
          dueDate: milestoneDueDate || undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to create milestone');
      setMilestoneTitle('');
      setMilestoneDescription('');
      setMilestoneDueDate('');
      setShowMilestoneForm(false);
      loadMilestones(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create milestone');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Tasks & deliverables"
        description="Project tasks — assign owners and track completion."
        icon={ClipboardList}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm((v) => !v);
                setShowMilestoneForm(false);
              }}
              disabled={!projects.length}
              className="btn-primary dash-panel-cta inline-flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              New task
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMilestoneForm((v) => !v);
                setShowForm(false);
              }}
              disabled={!projects.length}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3 py-2 text-sm font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)] disabled:opacity-50"
            >
              <Target className="h-4 w-4" />
              New milestone
            </button>
          </div>
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
              <StrideSelect
                value={projectId}
                onChange={(value) => setProjectId(value)}
                options={projects.map((p) => ({ value: p.id, label: `${p.projectCode} — ${p.name}` }))}
                ariaLabel="Project"
                className="w-full"
              />
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

      {showMilestoneForm ? (
        <form
          onSubmit={createMilestone}
          className="mb-6 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 shadow-sm"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium">Title</span>
              <input
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
                className="dash-auth-input w-full"
                required
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium">Description</span>
              <textarea
                value={milestoneDescription}
                onChange={(e) => setMilestoneDescription(e.target.value)}
                className="dash-auth-input w-full min-h-[4.5rem]"
                rows={2}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Project</span>
              <StrideSelect
                value={projectId}
                onChange={(value) => setProjectId(value)}
                options={projects.map((p) => ({ value: p.id, label: `${p.projectCode} — ${p.name}` }))}
                ariaLabel="Project"
                className="w-full"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Due date</span>
              <input
                type="date"
                value={milestoneDueDate}
                onChange={(e) => setMilestoneDueDate(e.target.value)}
                className="dash-auth-input w-full"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={saving} className="dash-auth-submit max-w-[12rem]">
              {saving ? 'Saving…' : 'Add milestone'}
            </button>
            <button
              type="button"
              onClick={() => setShowMilestoneForm(false)}
              className="rounded-lg px-3 py-2 text-sm text-[var(--dash-text-muted)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {projects.length > 0 ? (
        <section className="mb-6 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[var(--stride-coral)]" />
              <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Milestones</h2>
            </div>
            <label className="text-sm text-[var(--dash-text-muted)]">
              Project{' '}
              <StrideSelect
                value={projectId}
                onChange={(value) => setProjectId(value)}
                options={projects.map((p) => ({ value: p.id, label: `${p.projectCode} — ${p.name}` }))}
                ariaLabel="Project"
                className="ml-2 inline-block w-auto min-w-[14rem]"
              />
            </label>
          </div>

          {milestonesLoading ? (
            <div className="flex items-center py-6 text-sm text-[var(--dash-text-muted)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading milestones…
            </div>
          ) : !milestones?.length ? (
            <p className="py-4 text-sm text-[var(--dash-text-muted)]">
              No milestones for this project yet.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--dash-border-subtle)]">
              {milestones.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--dash-text-strong)]">{m.title}</p>
                    <p className="text-xs text-[var(--dash-text-muted)]">
                      {m.dueDate ? `Due ${m.dueDate}` : 'No due date'}
                      {typeof m.taskCount === 'number' ? ` · ${m.taskCount} task${m.taskCount === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${MILESTONE_STATUS_STYLES[m.status] ?? STATUS_STYLES[m.status] ?? ''}`}
                  >
                    {m.status.replace('_', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
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
