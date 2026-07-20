'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  FileText,
  GanttChart,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { ProjectBoard } from '@/components/dashboard/projects/ProjectBoard';
import { ProjectCalendar } from '@/components/dashboard/projects/ProjectCalendar';
import { ProjectTaskList } from '@/components/dashboard/projects/ProjectTaskList';
import { ProjectTimeline } from '@/components/dashboard/projects/ProjectTimeline';
import { TaskDrawer } from '@/components/dashboard/projects/TaskDrawer';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import type {
  ActivityDTO,
  AttachmentDTO,
  MemberDTO,
  MilestoneDTO,
  ProjectDTO,
  ProjectHealth,
  ProjectStatus,
  ProjectTaskStatus,
  TaskDTO,
} from '@/types/projects';
import {
  createMilestone,
  createTask,
  deleteMilestone,
  deleteProjectAttachment,
  fetchMembers,
  fetchProjectActivity,
  fetchProjectAttachments,
  fetchProjectBudget,
  fetchProjectWorkspace,
  patchMilestone,
  patchProject,
  patchTask,
  uploadProjectAttachment,
} from '@/app/dashboard/(app)/projects/_lib/api';
import {
  HEALTH_LABEL,
  HEALTH_STYLES,
  MILESTONE_STATUS_STYLES,
  PROJECT_STATUS_STYLES,
  initials,
} from '@/app/dashboard/(app)/projects/_lib/constants';

type TabId = 'overview' | 'board' | 'list' | 'timeline' | 'calendar' | 'files' | 'activity';

const TABS: { id: TabId; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'overview', label: 'Overview', icon: Briefcase },
  { id: 'board', label: 'Board', icon: LayoutGrid },
  { id: 'list', label: 'List', icon: List },
  { id: 'timeline', label: 'Timeline', icon: GanttChart },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'activity', label: 'Activity', icon: Activity },
];

export default function ProjectWorkspaceContent({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [milestones, setMilestones] = useState<MilestoneDTO[]>([]);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [activity, setActivity] = useState<ActivityDTO[]>([]);
  const [activityCursor, setActivityCursor] = useState<string | null>(null);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentDTO[]>([]);
  const [budget, setBudget] = useState<{
    utilizationPercent: number;
    totalActual: number;
    remaining: number;
    currency: string;
    budget: { allocated: number; name: string | null };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [confirmMsDelete, setConfirmMsDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ws, mem, act, atts, bud] = await Promise.all([
        fetchProjectWorkspace(projectId),
        fetchMembers(projectId).catch(() => ({ members: [] as MemberDTO[] })),
        fetchProjectActivity(projectId, { take: 12 }).catch(() => ({
          activity: [] as ActivityDTO[],
          nextCursor: null,
          hasMore: false,
        })),
        fetchProjectAttachments(projectId).catch(() => ({ attachments: [] as AttachmentDTO[] })),
        fetchProjectBudget(projectId).catch(() => null),
      ]);
      setProject(ws.project);
      setMilestones(ws.milestones);
      setTasks(ws.tasks);
      setNameDraft(ws.project.name);
      setMembers(mem.members);
      setActivity(act.activity);
      setActivityCursor(act.nextCursor);
      setActivityHasMore(act.hasMore);
      setAttachments(atts.attachments);
      setBudget(bud?.report ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keyboard: 1–7 switch tabs, N focuses list quick-add (via list tab).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, TabId> = {
        '1': 'overview',
        '2': 'board',
        '3': 'list',
        '4': 'timeline',
        '5': 'calendar',
        '6': 'files',
        '7': 'activity',
      };
      if (map[e.key]) {
        e.preventDefault();
        setTab(map[e.key]!);
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setTab('list');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const people = useMemo(() => {
    const map = new Map<string, string>();
    if (project?.owner) map.set(project.owner.id, project.owner.name);
    for (const m of members) {
      if (m.user) map.set(m.user.id, m.user.name);
    }
    for (const t of tasks) {
      if (t.assignee) map.set(t.assignee.id, t.assignee.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [project, members, tasks]);

  const topTasks = useMemo(() => tasks.filter((t) => !t.parentTaskId), [tasks]);

  const progressPct = useMemo(() => {
    if (!topTasks.length) return 0;
    const done = topTasks.filter((t) => t.status === 'done').length;
    return Math.round((done / topTasks.length) * 100);
  }, [topTasks]);

  const seedTask = useMemo(
    () => (drawerTaskId ? tasks.find((t) => t.id === drawerTaskId) ?? null : null),
    [drawerTaskId, tasks],
  );

  async function saveName() {
    if (!project || !nameDraft.trim() || nameDraft.trim() === project.name) {
      setEditingName(false);
      return;
    }
    try {
      const { project: updated } = await patchProject(projectId, { name: nameDraft.trim() });
      setProject(updated);
      setEditingName(false);
      toast.success('Project renamed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rename failed');
    }
  }

  async function updateProjectField(body: Record<string, unknown>) {
    try {
      const { project: updated } = await patchProject(projectId, body);
      setProject(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  }

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
    const { task } = await createTask({ projectId, title, status });
    setTasks((cur) => [...cur, task]);
    toast.success('Task created');
  }

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!milestoneTitle.trim()) return;
    try {
      const { milestone } = await createMilestone({
        projectId,
        title: milestoneTitle.trim(),
      });
      setMilestones((cur) => [...cur, milestone]);
      setMilestoneTitle('');
      toast.success('Milestone added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function toggleMilestoneDone(m: MilestoneDTO) {
    const next = m.status === 'done' ? 'pending' : 'done';
    try {
      const { milestone } = await patchMilestone(m.id, { status: next });
      setMilestones((cur) => cur.map((x) => (x.id === m.id ? milestone : x)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function removeMilestone() {
    if (!confirmMsDelete) return;
    try {
      await deleteMilestone(confirmMsDelete);
      setMilestones((cur) => cur.filter((m) => m.id !== confirmMsDelete));
      setConfirmMsDelete(null);
      toast.success('Milestone deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function addListTask(title: string) {
    try {
      const { task } = await createTask({
        projectId,
        title,
        status: 'todo',
      });
      setTasks((cur) => [...cur, task]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function loadMoreActivity() {
    if (!activityCursor) return;
    try {
      const next = await fetchProjectActivity(projectId, { take: 20, cursor: activityCursor });
      setActivity((cur) => [...cur, ...next.activity]);
      setActivityCursor(next.nextCursor);
      setActivityHasMore(next.hasMore);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function onProjectUpload(file: File) {
    try {
      const { attachment } = await uploadProjectAttachment(projectId, file);
      setAttachments((cur) => [attachment, ...cur]);
      toast.success('Uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    }
  }

  if (loading) {
    return (
      <DashboardPage>
        <div className="flex items-center justify-center py-24 text-[var(--dash-text-muted)]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading project…
        </div>
      </DashboardPage>
    );
  }

  if (error || !project) {
    return (
      <DashboardPage>
        <div className="py-16 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
          <p className="text-sm text-[var(--dash-text-muted)]">{error ?? 'Project not found'}</p>
          <Link href="/dashboard/projects/all" className="mt-4 inline-block text-sm text-[var(--brand-primary)] hover:underline">
            ← All projects
          </Link>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <div className="mb-4">
        <Link
          href="/dashboard/projects/all"
          className="inline-flex items-center gap-1 text-sm text-[var(--dash-text-muted)] hover:text-[var(--dash-text-strong)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All projects
        </Link>
      </div>

      {/* Header */}
      <header className="mb-6 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-[var(--dash-text-muted)]">{project.projectCode}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PROJECT_STATUS_STYLES[project.status]}`}>
                {project.status.replace('_', ' ')}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_STYLES[project.health]}`}>
                {HEALTH_LABEL[project.health]}
              </span>
            </div>
            {editingName ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => void saveName()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveName();
                  if (e.key === 'Escape') {
                    setNameDraft(project.name);
                    setEditingName(false);
                  }
                }}
                className="w-full border-0 bg-transparent text-2xl font-bold text-[var(--dash-text-strong)] outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="text-left text-2xl font-bold text-[var(--dash-text-strong)] hover:underline"
              >
                {project.name}
              </button>
            )}
            {project.description ? (
              <p className="mt-1 max-w-2xl text-sm text-[var(--dash-text-muted)]">{project.description}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--dash-text-muted)]">
              <span>
                {project.startDate ?? '—'} → {project.dueDate ?? '—'}
              </span>
              {project.owner ? <span>Owner: {project.owner.name}</span> : null}
              <div className="flex -space-x-1.5">
                {members.slice(0, 5).map((m) => (
                  <span
                    key={m.id}
                    title={m.user?.name ?? m.role}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--dash-surface-solid)] bg-[var(--stride-coral)] text-[9px] font-semibold text-white"
                  >
                    {initials(m.user?.name)}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3 max-w-md">
              <div className="mb-1 flex justify-between text-xs text-[var(--dash-text-muted)]">
                <span>Progress</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StrideSelect
              value={project.status}
              onChange={(v) => void updateProjectField({ status: v as ProjectStatus })}
              options={[
                { value: 'planning', label: 'Planning' },
                { value: 'active', label: 'Active' },
                { value: 'on_hold', label: 'On hold' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              ariaLabel="Project status"
              className="min-w-[8rem]"
              size="sm"
            />
            <StrideSelect
              value={project.health}
              onChange={(v) => void updateProjectField({ health: v as ProjectHealth })}
              options={[
                { value: 'on_track', label: 'On track' },
                { value: 'at_risk', label: 'At risk' },
                { value: 'off_track', label: 'Off track' },
              ]}
              ariaLabel="Project health"
              className="min-w-[8rem]"
              size="sm"
            />
            {budget ? (
              <div className="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-xs">
                <BarChart3 className="mr-1 inline h-3.5 w-3.5" />
                {budget.utilizationPercent}% budget
              </div>
            ) : null}
          </div>
        </div>

        <nav className="mt-5 flex gap-1 overflow-x-auto border-t border-[var(--dash-border)] pt-3" aria-label="Project tabs">
          {TABS.map((t, idx) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                title={`${t.label} (${idx + 1})`}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--stride-coral)] text-white'
                    : 'text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text-strong)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </nav>
        <p className="mt-2 text-[10px] text-[var(--dash-text-muted)]">
          Shortcuts: 1–7 tabs · N new task (list)
        </p>
      </header>

      {/* Overview */}
      {tab === 'overview' ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
                  <Target className="h-4 w-4 text-[var(--stride-coral)]" />
                  Milestones
                </h2>
              </div>
              {!milestones.length ? (
                <p className="mb-3 text-sm text-[var(--dash-text-muted)]">No milestones yet.</p>
              ) : (
                <ul className="mb-3 space-y-2">
                  {milestones.map((m) => {
                    const msTasks = topTasks.filter((t) => t.milestoneId === m.id);
                    const done = msTasks.filter((t) => t.status === 'done').length;
                    const pct = msTasks.length ? Math.round((done / msTasks.length) * 100) : m.progress;
                    return (
                      <li
                        key={m.id}
                        className="rounded-lg border border-[var(--dash-border-subtle)] px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => void toggleMilestoneDone(m)}
                            className="flex min-w-0 items-center gap-2 text-left"
                          >
                            <CheckCircle2
                              className={`h-4 w-4 shrink-0 ${m.status === 'done' ? 'text-emerald-500' : 'text-neutral-300'}`}
                            />
                            <span className="truncate text-sm font-medium text-[var(--dash-text-strong)]">
                              {m.title}
                            </span>
                          </button>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${MILESTONE_STATUS_STYLES[m.status]}`}>
                              {m.status.replace('_', ' ')}
                            </span>
                            <button
                              type="button"
                              onClick={() => setConfirmMsDelete(m.id)}
                              className="text-[var(--dash-text-muted)] hover:text-red-600"
                              aria-label="Delete milestone"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--dash-text-muted)]">
                          {done}/{msTasks.length} tasks
                          {m.dueDate ? ` · due ${m.dueDate}` : ''}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
              <form onSubmit={(e) => void addMilestone(e)} className="flex gap-2">
                <input
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  placeholder="New milestone…"
                  className="dash-auth-input flex-1 text-sm"
                />
                <button type="submit" className="btn-primary inline-flex items-center gap-1 px-3 py-2 text-sm">
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </form>
            </section>

            <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
              <h2 className="mb-3 text-sm font-semibold text-[var(--dash-text-strong)]">Recent activity</h2>
              {!activity.length ? (
                <p className="text-sm text-[var(--dash-text-muted)]">No activity yet.</p>
              ) : (
                <ul className="space-y-2">
                  {activity.slice(0, 8).map((a) => (
                    <li key={a.id} className="flex justify-between gap-2 border-b border-[var(--dash-border-subtle)] pb-2 text-sm last:border-0">
                      <span className="text-[var(--dash-text-body)]">
                        <span className="font-medium">{a.actor?.name ?? 'System'}</span> {a.summary}
                      </span>
                      <span className="shrink-0 text-[10px] text-[var(--dash-text-muted)]">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Tasks" value={`${topTasks.filter((t) => t.status === 'done').length}/${topTasks.length}`} />
              <Stat label="Milestones" value={`${milestones.filter((m) => m.status === 'done').length}/${milestones.length}`} />
              <Stat label="Open" value={String(topTasks.filter((t) => t.status !== 'done').length)} />
              <Stat
                label="Overdue"
                value={String(
                  topTasks.filter(
                    (t) => t.dueDate && t.status !== 'done' && t.dueDate < new Date().toISOString().slice(0, 10),
                  ).length,
                )}
                warn
              />
            </div>
            {budget ? (
              <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
                <h2 className="mb-2 text-sm font-semibold">Budget</h2>
                <p className="text-2xl font-bold">{budget.utilizationPercent}%</p>
                <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
                  {budget.totalActual.toLocaleString()} / {budget.budget.allocated.toLocaleString()} {budget.currency}
                </p>
                <Link href="/dashboard/projects/budget" className="mt-2 inline-block text-xs text-[var(--brand-primary)] hover:underline">
                  Budget detail →
                </Link>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Board */}
      {tab === 'board' ? (
        <ProjectBoard
          tasks={tasks}
          onCardClick={setDrawerTaskId}
          onStatusChange={onStatusChange}
          onQuickAdd={onQuickAdd}
        />
      ) : null}

      {/* List */}
      {tab === 'list' ? (
        <ProjectTaskList
          projectId={projectId}
          tasks={tasks}
          milestones={milestones}
          people={people}
          onTaskClick={setDrawerTaskId}
          onQuickAdd={addListTask}
          onStatusChange={onStatusChange}
        />
      ) : null}

      {/* Timeline */}
      {tab === 'timeline' ? (
        <ProjectTimeline
          projectStart={project.startDate}
          projectDue={project.dueDate}
          milestones={milestones}
          tasks={tasks}
          onTaskClick={setDrawerTaskId}
        />
      ) : null}

      {/* Calendar */}
      {tab === 'calendar' ? (
        <ProjectCalendar
          tasks={tasks}
          milestones={milestones}
          onTaskClick={setDrawerTaskId}
        />
      ) : null}

      {/* Files */}
      {tab === 'files' ? (
        <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Project files</h2>
            <input
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onProjectUpload(f);
                e.target.value = '';
              }}
              className="text-sm"
            />
          </div>
          {!attachments.length ? (
            <p className="py-8 text-center text-sm text-[var(--dash-text-muted)]">No files yet. Upload one above.</p>
          ) : (
            <ul className="divide-y divide-[var(--dash-border-subtle)]">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <a href={a.fileUrl} target="_blank" rel="noreferrer" className="truncate text-[var(--brand-primary)] hover:underline">
                    {a.fileName}
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      void deleteProjectAttachment(projectId, a.id)
                        .then(() => setAttachments((cur) => cur.filter((x) => x.id !== a.id)))
                        .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed'))
                    }
                    className="text-xs text-red-600"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Activity */}
      {tab === 'activity' ? (
        <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
          {!activity.length ? (
            <p className="py-8 text-center text-sm text-[var(--dash-text-muted)]">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-3 border-b border-[var(--dash-border-subtle)] pb-3 last:border-0">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--stride-coral)] text-[10px] font-semibold text-white">
                    {initials(a.actor?.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--dash-text-body)]">
                      <span className="font-medium text-[var(--dash-text-strong)]">{a.actor?.name ?? 'System'}</span>{' '}
                      {a.summary}
                    </p>
                    <p className="text-[11px] text-[var(--dash-text-muted)]">
                      {new Date(a.createdAt).toLocaleString()} · {a.type.replace(/_/g, ' ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {activityHasMore ? (
            <button
              type="button"
              onClick={() => void loadMoreActivity()}
              className="mt-4 text-sm text-[var(--brand-primary)] hover:underline"
            >
              Load more
            </button>
          ) : null}
        </section>
      ) : null}

      <TaskDrawer
        open={!!drawerTaskId}
        taskId={drawerTaskId}
        seedTask={seedTask}
        projectId={projectId}
        milestones={milestones}
        projectTasks={tasks}
        people={people}
        onClose={() => setDrawerTaskId(null)}
        onTaskUpdated={(updated) =>
          setTasks((cur) => cur.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
        }
        onTaskDeleted={(id) => {
          setTasks((cur) => cur.filter((t) => t.id !== id && t.parentTaskId !== id));
          setDrawerTaskId(null);
        }}
      />

      <ConfirmDialog
        open={!!confirmMsDelete}
        title="Delete milestone?"
        description="Tasks stay on the project but will be unlinked from this milestone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => void removeMilestone()}
        onCancel={() => setConfirmMsDelete(null)}
      />
    </DashboardPage>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3">
      <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">{label}</p>
      <p className={`text-lg font-bold ${warn && value !== '0' ? 'text-red-600' : ''}`}>{value}</p>
    </div>
  );
}
