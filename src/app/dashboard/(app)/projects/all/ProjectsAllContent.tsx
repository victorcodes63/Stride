'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Loader2, Plus, AlertCircle } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type ProjectRow = {
  id: string;
  projectCode: string;
  name: string;
  status: string;
  department: string | null;
  dueDate: string | null;
  owner: { id: string; name: string } | null;
  taskCount?: number;
  milestoneCount?: number;
};

const STATUS_STYLES: Record<string, string> = {
  planning: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-50 text-emerald-800',
  on_hold: 'bg-amber-50 text-amber-800',
  completed: 'bg-neutral-100 text-neutral-600',
  cancelled: 'bg-neutral-100 text-neutral-500',
};

export default function ProjectsAllContent() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [dueDate, setDueDate] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = filter ? `?status=${filter}` : '';
    fetch(`/api/projects${q}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        return data;
      })
      .then((data) => setProjects(data.projects ?? []))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setProjects([]);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          department: department.trim() || undefined,
          dueDate: dueDate || undefined,
          status: 'active',
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to create');
      setName('');
      setDepartment('');
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
        title="All projects"
        description="Project register with milestones and tasks — scoped to your current workspace."
        icon={Briefcase}
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New project
          </button>
        }
      />

      {showForm ? (
        <form
          onSubmit={createProject}
          className="mb-6 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 shadow-sm"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-[var(--dash-text-strong)]">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="dash-auth-input w-full"
                placeholder="e.g. HQ fit-out phase 1"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--dash-text-strong)]">Department</span>
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="dash-auth-input w-full"
                placeholder="Optional"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--dash-text-strong)]">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="dash-auth-input w-full"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="dash-auth-submit max-w-[10rem]"
            >
              {saving ? 'Saving…' : 'Create project'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-2 text-sm text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {['', 'planning', 'active', 'on_hold', 'completed'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === s ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {s ? s.replace('_', ' ') : 'All'}
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
          Loading projects…
        </div>
      ) : !projects?.length ? (
        <p className="py-12 text-center text-sm text-[var(--dash-text-muted)]">
          No projects yet. Create one to start tracking milestones and tasks.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)]">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--dash-border)] bg-[var(--dash-surface-muted)] text-left text-[var(--dash-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Tasks</th>
                <th className="px-4 py-3 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-[var(--dash-border-subtle)] last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-[var(--dash-text-muted)]">{p.projectCode}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/projects/all?highlight=${p.id}`} className="font-medium text-[var(--dash-text-strong)] hover:underline">
                      {p.name}
                    </Link>
                    {p.department ? (
                      <p className="text-xs text-[var(--dash-text-muted)]">{p.department}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[p.status] ?? ''}`}>
                      {p.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--dash-text-body)]">{p.owner?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--dash-text-body)]">{p.taskCount ?? 0}</td>
                  <td className="px-4 py-3 text-[var(--dash-text-muted)]">{p.dueDate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPage>
  );
}
