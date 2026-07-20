'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Briefcase, LayoutGrid, Loader2, AlertCircle, Plus } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ProjectBoard } from '@/components/dashboard/projects/ProjectBoard';
import { TaskDrawer } from '@/components/dashboard/projects/TaskDrawer';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import type { ProjectTaskStatus, TaskDTO } from '@/types/projects';
import {
  createTask,
  fetchProjectTasks,
  patchTask,
} from '@/app/dashboard/(app)/projects/_lib/api';

export default function ProjectBoardContent() {
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState('');
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchProjectTasks({
      projectId: projectFilter || undefined,
      include: 'subtasks',
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
    for (const t of tasks) {
      if (t.project) {
        map.set(t.project.id, {
          id: t.project.id,
          label: `${t.project.projectCode} — ${t.project.name}`,
        });
      }
    }
    return [...map.values()];
  }, [tasks]);

  const seedTask = useMemo(
    () => (drawerTaskId ? tasks.find((t) => t.id === drawerTaskId) ?? null : null),
    [drawerTaskId, tasks],
  );

  const activeProjectId = projectFilter || seedTask?.projectId || tasks[0]?.projectId || '';

  async function onStatusChange(taskId: string, status: ProjectTaskStatus) {
    const prev = tasks;
    setTasks((cur) => cur.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      const { task } = await patchTask(taskId, { status });
      setTasks((cur) => cur.map((t) => (t.id === taskId ? task : t)));
    } catch (e) {
      setTasks(prev);
      toast.error(e instanceof Error ? e.message : 'Move failed');
    }
  }

  async function onQuickAdd(status: ProjectTaskStatus, title: string) {
    const pid = projectFilter || tasks.find((t) => t.project)?.project?.id;
    if (!pid) {
      toast.error('Select a project first, or create one.');
      return;
    }
    const { task } = await createTask({ projectId: pid, title, status });
    setTasks((cur) => [...cur, task]);
    toast.success('Task created');
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Project board"
        description="Drag tasks across columns. Click a card for details."
        icon={LayoutGrid}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/projects/tasks"
              className="btn-primary dash-panel-cta inline-flex items-center gap-2 px-3 py-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              New task
            </Link>
            <Link
              href="/dashboard/projects/all?new=1"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3 py-2 text-sm font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)]"
            >
              <Briefcase className="h-4 w-4" />
              New project
            </Link>
          </div>
        }
      />

      {projects.length > 0 || projectFilter ? (
        <div className="mb-4">
          <label className="text-sm text-[var(--dash-text-muted)]">
            Filter by project{' '}
            <StrideSelect
              value={projectFilter}
              onChange={setProjectFilter}
              options={[
                { value: '', label: 'All projects' },
                ...projects.map((p) => ({ value: p.id, label: p.label })),
              ]}
              ariaLabel="Filter by project"
              className="ml-2 inline-block w-auto min-w-[14rem]"
            />
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
      ) : !tasks.length ? (
        <div className="rounded-xl border border-dashed border-[var(--dash-border)] px-6 py-16 text-center">
          <p className="text-sm font-medium text-[var(--dash-text-strong)]">No tasks on the board</p>
          <p className="mt-1 text-sm text-[var(--dash-text-muted)]">
            Create a project, then add tasks — or use Quick-add on a column once a project exists.
          </p>
          <Link
            href="/dashboard/projects/all?new=1"
            className="btn-primary mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Briefcase className="h-4 w-4" />
            New project
          </Link>
        </div>
      ) : (
        <ProjectBoard
          tasks={tasks}
          onCardClick={setDrawerTaskId}
          onStatusChange={onStatusChange}
          onQuickAdd={onQuickAdd}
        />
      )}

      {activeProjectId ? (
        <TaskDrawer
          open={!!drawerTaskId}
          taskId={drawerTaskId}
          seedTask={seedTask}
          projectId={activeProjectId}
          projectTasks={tasks.filter((t) => t.projectId === activeProjectId)}
          onClose={() => setDrawerTaskId(null)}
          onTaskUpdated={(updated) =>
            setTasks((cur) => cur.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
          }
          onTaskDeleted={(id) => {
            setTasks((cur) => cur.filter((t) => t.id !== id));
            setDrawerTaskId(null);
          }}
        />
      ) : null}
    </DashboardPage>
  );
}
