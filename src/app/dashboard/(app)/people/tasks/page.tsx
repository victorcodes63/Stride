'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock,
  Inbox,
  Loader2,
  Plus,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { CreateOnboardingTaskModal } from '@/components/onboarding/CreateOnboardingTaskModal';
import { TaskDetailDrawer } from '@/components/onboarding/TaskDetailDrawer';
import { TaskAvatar } from '@/components/onboarding/TaskAvatar';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import {
  type TaskRow,
  daysUntil,
  dueRelativeLabel,
  dueUrgencyTone,
  formatDate,
  isOpen,
  isOverdue,
  isUnassigned,
  participantName,
  priorityMeta,
  recurrenceLabel,
  roleLabel,
  statusLabel,
  taskEmployee,
  taskStatusTone,
  workflowTypeLabel,
} from '@/components/onboarding/task-view';

type StatusTab = 'active' | 'overdue' | 'completed' | 'all';
type Scope = 'mine' | 'all';
type AssignmentFilter = 'all' | 'mine' | 'unassigned';
type TypeFilter = 'all' | 'ONBOARDING' | 'OFFBOARDING' | 'OPERATIONAL';
type SortKey = 'due' | 'created' | 'title';

const TAB_STATUSES: Record<StatusTab, string> = {
  active: 'PENDING,IN_PROGRESS,OVERDUE',
  overdue: 'PENDING,IN_PROGRESS,OVERDUE',
  completed: 'COMPLETED,SKIPPED',
  all: 'PENDING,IN_PROGRESS,OVERDUE,COMPLETED,SKIPPED',
};

type TasksResponse = {
  tasks: TaskRow[];
  canManage?: boolean;
  canCreate?: boolean;
  currentUserId?: string | null;
  roleKeys?: string[];
};

async function fetchTasks(params: { scope: Scope; statuses: string; q?: string }): Promise<TasksResponse> {
  const search = new URLSearchParams({ scope: params.scope, statuses: params.statuses });
  if (params.q) search.set('q', params.q);
  const res = await fetch(`/api/onboarding/tasks?${search.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load tasks.');
  return {
    tasks: Array.isArray(data) ? data : Array.isArray(data.tasks) ? data.tasks : [],
    canManage: data?.canManage === true || data?.canCreate === true,
    canCreate: data?.canCreate === true,
    currentUserId: typeof data?.currentUserId === 'string' ? data.currentUserId : null,
    roleKeys: Array.isArray(data?.roleKeys) ? data.roleKeys : [],
  };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [statsTasks, setStatsTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scope, setScope] = useState<Scope>('mine');
  const [tab, setTab] = useState<StatusTab>('active');
  const [assignment, setAssignment] = useState<AssignmentFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<SortKey>('due');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [canManage, setCanManage] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [roleKeys, setRoleKeys] = useState<string[]>([]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchTasks({ scope, statuses: TAB_STATUSES.active });
      setStatsTasks(data.tasks);
      setCanManage(Boolean(data.canManage));
      setCanCreate(Boolean(data.canCreate));
      setCurrentUserId(data.currentUserId ?? null);
      setRoleKeys(data.roleKeys ?? []);
    } catch {
      /* stats are best-effort */
    }
  }, [scope]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTasks({ scope, statuses: TAB_STATUSES[tab], q: debouncedSearch });
      setTasks(data.tasks);
      setCanManage(Boolean(data.canManage));
      setCanCreate(Boolean(data.canCreate));
      setCurrentUserId(data.currentUserId ?? null);
      setRoleKeys(data.roleKeys ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [scope, tab, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const refreshAll = useCallback(() => {
    void load();
    void loadStats();
  }, [load, loadStats]);

  // KPI counts derived from the stable "active" dataset.
  const stats = useMemo(() => {
    const open = statsTasks.filter(isOpen);
    return {
      open: open.length,
      dueSoon: open.filter((t) => {
        const d = daysUntil(t.dueDate);
        return d !== null && d >= 0 && d <= 3;
      }).length,
      overdue: open.filter(isOverdue).length,
      unassigned: open.filter(isUnassigned).length,
    };
  }, [statsTasks]);

  const visibleTasks = useMemo(() => {
    let list = tasks.slice();
    if (tab === 'overdue') list = list.filter(isOverdue);
    if (typeFilter !== 'all') list = list.filter((t) => t.workflow.type === typeFilter);
    if (assignment === 'mine') list = list.filter((t) => t.assignedTo?.id === currentUserId);
    if (assignment === 'unassigned') list = list.filter(isUnassigned);

    list.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'created') return (b.order ?? 0) - (a.order ?? 0);
      // due: soonest first, nulls last
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      return da - db;
    });
    return list;
  }, [tasks, tab, typeFilter, assignment, currentUserId, sort]);

  const selectableIds = useMemo(
    () => visibleTasks.filter((t) => isOpen(t)).map((t) => t.id),
    [visibleTasks],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (selectableIds.every((id) => prev.has(id))) return new Set();
      return new Set(selectableIds);
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function runBulk(kind: 'complete' | 'claim' | 'remind') {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkBusy(true);
    setError(null);
    let ok = 0;
    let failed = 0;
    await Promise.all(
      ids.map(async (id) => {
        try {
          if (kind === 'remind') {
            const res = await fetch(`/api/onboarding/tasks/${id}/remind`, { method: 'POST' });
            if (!res.ok) throw new Error();
          } else {
            const body = kind === 'complete' ? { status: 'COMPLETED' } : { claim: true };
            const res = await fetch(`/api/onboarding/tasks/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error();
          }
          ok += 1;
        } catch {
          failed += 1;
        }
      }),
    );
    setBulkBusy(false);
    clearSelection();
    refreshAll();
    const verb = kind === 'complete' ? 'completed' : kind === 'claim' ? 'claimed' : 'reminded';
    if (ok > 0) toast.success(`${ok} ${ok === 1 ? 'task' : 'tasks'} ${verb}.`);
    if (failed > 0) toast.error(`${failed} ${failed === 1 ? 'task' : 'tasks'} could not be ${verb}.`);
  }

  async function quickAction(task: TaskRow, kind: 'complete' | 'claim') {
    if (kind === 'complete' && (task.category ?? '').toLowerCase() === 'documents' && !task.documentId) {
      toast.error('Attach evidence before completing this Documents task. Open the task to upload.');
      setOpenTaskId(task.id);
      return;
    }
    try {
      const body = kind === 'complete' ? { status: 'COMPLETED' } : { claim: true };
      const res = await fetch(`/api/onboarding/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Action failed.');
      toast.success(kind === 'complete' ? 'Task marked done.' : 'Task claimed.');
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed.');
    }
  }

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'completed', label: 'Completed' },
    { key: 'all', label: 'All' },
  ];

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={ClipboardList}
        title="Tasks"
        description="Tasks assigned to your role or to you personally."
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

      {/* KPI cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Inbox}
          tone="primary"
          label="Open tasks"
          value={stats.open}
          active={tab === 'active' && assignment === 'all'}
          onClick={() => {
            setTab('active');
            setAssignment('all');
            setTypeFilter('all');
          }}
        />
        <StatCard
          icon={Clock}
          tone="warning"
          label="Due within 3 days"
          value={stats.dueSoon}
          onClick={() => {
            setTab('active');
            setSort('due');
          }}
        />
        <StatCard
          icon={AlertTriangle}
          tone="danger"
          label="Overdue"
          value={stats.overdue}
          active={tab === 'overdue'}
          onClick={() => setTab('overdue')}
        />
        <StatCard
          icon={Users}
          tone="info"
          label="Unassigned (pools)"
          value={stats.unassigned}
          active={assignment === 'unassigned'}
          onClick={() => {
            setTab('active');
            setAssignment('unassigned');
          }}
        />
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <DashboardTableCard>
        {/* Tabs + scope */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dash-border)] px-4 py-3 sm:px-5">
          <div className="inline-flex rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-0.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-[var(--dash-surface-solid)] text-[var(--dash-text-strong)] shadow-sm'
                    : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text-body)]'
                }`}
              >
                {t.label}
                {t.key === 'overdue' && stats.overdue > 0 ? (
                  <span className="ml-1.5 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                    {stats.overdue}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {canManage ? (
            <div className="inline-flex rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-0.5">
              {(['mine', 'all'] as Scope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    scope === s
                      ? 'bg-[var(--dash-surface-solid)] text-[var(--dash-text-strong)] shadow-sm'
                      : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text-body)]'
                  }`}
                >
                  {s === 'mine' ? 'My queue' : 'All tasks'}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <DashboardTableToolbar label={null}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative inline-flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-neutral-400" />
              <input
                className="h-9 w-56 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] py-1.5 pl-8 pr-3 text-sm"
                placeholder="Search tasks or people…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search tasks"
              />
            </label>
            <StrideSelect
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as TypeFilter)}
              options={[
                { value: 'all', label: 'All types' },
                { value: 'OPERATIONAL', label: 'Operational' },
                { value: 'ONBOARDING', label: 'Onboarding' },
                { value: 'OFFBOARDING', label: 'Offboarding' },
              ]}
              ariaLabel="Task type"
              size="sm"
            />
            <StrideSelect
              value={assignment}
              onChange={(v) => setAssignment(v as AssignmentFilter)}
              options={[
                { value: 'all', label: 'Any assignee' },
                { value: 'mine', label: 'Assigned to me' },
                { value: 'unassigned', label: 'Unassigned pools' },
              ]}
              ariaLabel="Assignment"
              size="sm"
            />
            <StrideSelect
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                { value: 'due', label: 'Sort: Due date' },
                { value: 'created', label: 'Sort: Newest' },
                { value: 'title', label: 'Sort: Name' },
              ]}
              ariaLabel="Sort"
              size="sm"
            />
          </div>
        </DashboardTableToolbar>

        {/* Bulk action bar */}
        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--dash-border)] bg-[color-mix(in_srgb,var(--brand-primary)_8%,var(--dash-surface-solid))] px-4 py-2.5 sm:px-5">
            <span className="text-sm font-medium text-[var(--dash-text-strong)]">{selected.size} selected</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void runBulk('claim')}
                className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" /> Claim
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void runBulk('remind')}
                className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                <Bell className="h-3.5 w-3.5" /> Remind
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void runBulk('complete')}
                className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Mark done
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
                aria-label="Clear selection"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tasks…
          </div>
        ) : visibleTasks.length === 0 ? (
          <DashboardTableEmpty
            icon={<ClipboardList className="h-8 w-8 text-neutral-300" aria-hidden />}
            title={tab === 'completed' ? 'No completed tasks yet' : 'You are all caught up'}
            description={
              tab === 'completed'
                ? 'Completed and skipped tasks will appear here.'
                : 'When HR starts a workflow or assigns a task to your role, it will show up here.'
            }
          />
        ) : (
          <DashboardTableViewport minWidth={980}>
            <DashboardTable>
              <thead className="bg-[var(--dash-surface-muted)] text-left text-[var(--dash-text-muted)]">
                <tr>
                  {canManage ? (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all"
                        className="h-4 w-4 cursor-pointer accent-[var(--brand-primary)]"
                      />
                    </th>
                  ) : null}
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Participant</th>
                  <th className="px-4 py-3 font-medium">Belongs to</th>
                  <th className="px-4 py-3 font-medium">Assignee</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="w-px whitespace-nowrap px-4 py-3 font-medium" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((task) => {
                  const open = isOpen(task);
                  const overdue = isOverdue(task);
                  const dueTone = dueUrgencyTone(task);
                  const canClaim = open && (!task.assignedTo?.id || task.assignedTo.id !== currentUserId);
                  const isSelected = selected.has(task.id);
                  return (
                    <tr
                      key={task.id}
                      onClick={() => setOpenTaskId(task.id)}
                      className={`group cursor-pointer border-t border-[var(--dash-border-subtle)] transition-colors hover:bg-[var(--dash-hover)] ${
                        isSelected ? 'bg-[color-mix(in_srgb,var(--brand-primary)_6%,transparent)]' : ''
                      }`}
                    >
                      {canManage ? (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!open}
                            onChange={() => toggleSelect(task.id)}
                            aria-label={`Select ${task.title}`}
                            className="h-4 w-4 cursor-pointer accent-[var(--brand-primary)] disabled:opacity-30"
                          />
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          {overdue ? (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden />
                          ) : task.isRequired && open ? (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
                          ) : (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent" aria-hidden />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-[var(--dash-text-strong)]">{task.title}</span>
                              {(() => {
                                const p = (task.priority ?? 'MEDIUM').toUpperCase();
                                if (p !== 'HIGH' && p !== 'URGENT') return null;
                                const meta = priorityMeta(task.priority);
                                return (
                                  <span
                                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                    style={{ background: `${meta.dot}1f`, color: meta.dot }}
                                  >
                                    {meta.label}
                                  </span>
                                );
                              })()}
                            </div>
                            {task.description ? (
                              <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-[var(--dash-text-muted)]">
                                {task.description}
                              </p>
                            ) : null}
                            {task.document ? (
                              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--dash-text-muted)]">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Evidence attached
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const emp = taskEmployee(task);
                          if (!emp) {
                            return <span className="text-sm text-[var(--dash-text-muted)]">—</span>;
                          }
                          const name = participantName(task);
                          const inner = (
                            <>
                              <TaskAvatar name={name} seed={emp.id} />
                              <span className="truncate">{name}</span>
                            </>
                          );
                          return task.workflow.type === 'OPERATIONAL' ? (
                            <span className="inline-flex items-center gap-2 text-sm text-[var(--dash-text-body)]">
                              {inner}
                            </span>
                          ) : (
                            <Link
                              href={`/dashboard/onboarding/${task.workflow.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-2 text-sm text-[var(--dash-text-body)] hover:text-[var(--brand-primary)]"
                            >
                              {inner}
                            </Link>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              task.workflow.type === 'ONBOARDING'
                                ? 'bg-emerald-500/12 text-emerald-700'
                                : task.workflow.type === 'OFFBOARDING'
                                  ? 'bg-violet-500/12 text-violet-700'
                                  : 'bg-sky-500/12 text-sky-700'
                            }`}
                          >
                            {workflowTypeLabel(task.workflow.type)}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--dash-text-muted)]">
                            {roleLabel(task.assignedRole)}
                          </span>
                          {recurrenceLabel(task.recurrence) ? (
                            <span className="inline-flex items-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--dash-text-muted)]">
                              ↻
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {task.assignedTo ? (
                          <span className="inline-flex items-center gap-2 text-sm text-[var(--dash-text-body)]">
                            <TaskAvatar name={task.assignedTo.name} seed={task.assignedTo.id} />
                            <span className="truncate">{task.assignedTo.name}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-sm text-[var(--dash-text-muted)]">
                            <TaskAvatar name={roleLabel(task.assignedRole)} muted />
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm ${
                            dueTone === 'danger'
                              ? 'font-medium text-rose-600'
                              : dueTone === 'warning'
                                ? 'font-medium text-amber-600'
                                : 'text-[var(--dash-text-muted)]'
                          }`}
                          title={formatDate(task.dueDate)}
                        >
                          {dueRelativeLabel(task)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={dashStatusChip(taskStatusTone(task.status))}>{statusLabel(task.status)}</span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {open ? (
                          <div className="flex items-center justify-end gap-1.5 opacity-100 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
                            {canClaim ? (
                              <button
                                type="button"
                                onClick={() => void quickAction(task, 'claim')}
                                className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs"
                                title="Claim"
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => void quickAction(task, 'complete')}
                              className="btn-primary inline-flex items-center gap-1 px-2 py-1 text-xs"
                              title="Mark done"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
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
        <CreateOnboardingTaskModal onClose={() => setShowCreate(false)} onCreated={refreshAll} />
      ) : null}

      {openTaskId ? (
        <TaskDetailDrawer
          taskId={openTaskId}
          canManage={canManage}
          currentUserId={currentUserId}
          roleKeys={roleKeys}
          onClose={() => setOpenTaskId(null)}
          onChanged={refreshAll}
        />
      ) : null}
    </DashboardPage>
  );
}

type StatTone = 'primary' | 'warning' | 'danger' | 'info';

const STAT_TONES: Record<StatTone, { bg: string; fg: string }> = {
  primary: { bg: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)', fg: 'var(--brand-primary)' },
  warning: { bg: 'rgba(234, 179, 8, 0.15)', fg: '#b45309' },
  danger: { bg: 'rgba(244, 63, 94, 0.14)', fg: '#e11d48' },
  info: { bg: 'rgba(59, 130, 246, 0.14)', fg: '#2563eb' },
};

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  active,
  onClick,
}: {
  icon: typeof Inbox;
  tone: StatTone;
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const colors = STAT_TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border bg-[var(--dash-surface)] p-4 text-left shadow-sm transition-all hover:shadow-md ${
        active ? 'border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]' : 'border-[var(--dash-border)]'
      }`}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ background: colors.bg, color: colors.fg }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-bold tabular-nums leading-tight text-[var(--dash-text-strong)]">
          {value}
        </span>
        <span className="block truncate text-xs text-[var(--dash-text-muted)]">{label}</span>
      </span>
    </button>
  );
}
