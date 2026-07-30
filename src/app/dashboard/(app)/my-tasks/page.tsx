'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Inbox,
  ListChecks,
  Plus,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';
import { DashboardPage, DashboardPageHeader } from '@/components/dashboard/DashboardPage';
import { DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';
import { TaskEditModal, type TaskEditForm } from '@/components/staff-tasks/TaskEditModal';
import { TaskRow } from '@/components/staff-tasks/TaskRow';
import { TaskStatCards, type TaskStatKey } from '@/components/staff-tasks/TaskStatCards';
import type {
  Assignee,
  DueFilter,
  Scope,
  StaffTask,
  StatusFilter,
  TaskStats,
} from '@/components/staff-tasks/types';
import {
  INPUT_CLASS,
  TAB_CLASS,
  groupTasksForDisplay,
  toDateInputValue,
} from '@/components/staff-tasks/task-utils';
import { StrideButton } from '@/components/ui/stride-button';
import { StrideSelect } from '@/components/ui/stride-select';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'active', label: 'Open' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All statuses' },
];

const DUE_OPTIONS: Array<{ value: DueFilter; label: string }> = [
  { value: '', label: 'Any due date' },
  { value: 'today', label: 'Due today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'no_date', label: 'No date' },
];

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

export default function MyTasksPage() {
  const initialQuery =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialScope = initialQuery?.get('scope');
  const initialDue = initialQuery?.get('due');
  const focusTaskId = initialQuery?.get('task') ?? null;

  const [scope, setScope] = useState<Scope>(
    initialScope === 'all' || initialScope === 'created_by_me' || initialScope === 'assigned_to_me'
      ? initialScope
      : 'assigned_to_me',
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(focusTaskId ? 'all' : 'active');
  const [dueFilter, setDueFilter] = useState<DueFilter>(
    initialDue === 'today' ||
      initialDue === 'overdue' ||
      initialDue === 'upcoming' ||
      initialDue === 'no_date'
      ? initialDue
      : '',
  );
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(focusTaskId);
  const [searchQuery, setSearchQuery] = useState('');
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [stats, setStats] = useState<TaskStats>({ open: 0, overdue: 0, done: 0 });
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canViewAllTasks, setCanViewAllTasks] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickAssigneeId, setQuickAssigneeId] = useState('');
  const [quickDue, setQuickDue] = useState('');
  const [quickPriority, setQuickPriority] = useState<StaffTask['priority']>('none');
  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffTask | null>(null);
  const [editForm, setEditForm] = useState<TaskEditForm>({
    title: '',
    description: '',
    assigneeId: '',
    dueAt: '',
    priority: 'none',
    status: 'todo',
  });
  const [searchOpen, setSearchOpen] = useState(Boolean(focusTaskId));
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [dueMenuOpen, setDueMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const quickTitleRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const dueMenuRef = useRef<HTMLDivElement | null>(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [openRes, overdueRes, doneRes] = await Promise.all([
        fetch('/api/staff/tasks?scope=assigned_to_me&status=active'),
        fetch('/api/staff/tasks?scope=assigned_to_me&status=active&due=overdue'),
        fetch('/api/staff/tasks?scope=assigned_to_me&status=done'),
      ]);
      const [open, overdue, done] = await Promise.all([
        parseJsonResponse<StaffTask[]>(openRes),
        parseJsonResponse<StaffTask[]>(overdueRes),
        parseJsonResponse<StaffTask[]>(doneRes),
      ]);
      setStats({
        open: Array.isArray(open) ? open.length : 0,
        overdue: Array.isArray(overdue) ? overdue.length : 0,
        done: Array.isArray(done) ? done.length : 0,
      });
    } catch {
      /* keep previous stats */
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    const meRes = await fetch('/api/auth/me');
    const me = await parseJsonResponse<Record<string, unknown>>(meRes);
    if (!meRes.ok) throw new Error('Not signed in');
    setIsAdmin(me.role === 'admin');
    setCanViewAllTasks(me.canAccessCompanyTasks === true || me.role === 'admin');
    setCurrentUserId(typeof me.id === 'string' ? me.id : null);

    const params = new URLSearchParams({ scope });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (dueFilter) params.set('due', dueFilter);

    const [tasksRes, assigneesRes] = await Promise.all([
      fetch(`/api/staff/tasks?${params}`),
      fetch('/api/staff/tasks/assignees'),
    ]);
    const tasksData = await parseJsonResponse<StaffTask[] | { error?: string }>(tasksRes);
    const assigneesData = await parseJsonResponse<Assignee[] | { error?: string }>(assigneesRes);
    if (!tasksRes.ok) {
      const err = tasksData as { error?: string };
      if (tasksRes.status === 401) throw new Error('Please sign in again to view tasks.');
      throw new Error(err?.error || `Failed to load tasks (${tasksRes.status})`);
    }
    if (!assigneesRes.ok) {
      const err = assigneesData as { error?: string };
      throw new Error(err?.error || `Failed to load team (${assigneesRes.status})`);
    }
    setTasks(Array.isArray(tasksData) ? tasksData : []);
    setAssignees(Array.isArray(assigneesData) ? assigneesData : []);
  }, [scope, statusFilter, dueFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load tasks.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!highlightedTaskId || loading) return;
    const el = document.getElementById(`task-${highlightedTaskId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(() => setHighlightedTaskId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [highlightedTaskId, loading, tasks]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.assignee?.name.toLowerCase().includes(q) ||
        t.createdBy.name.toLowerCase().includes(q),
    );
  }, [tasks, searchQuery]);

  const taskGroups = useMemo(() => groupTasksForDisplay(filteredTasks), [filteredTasks]);

  const createTask = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/staff/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          assigneeId: quickAssigneeId || undefined,
          assignToMe: !quickAssigneeId,
          dueAt: quickDue || null,
          priority: quickPriority,
        }),
      });
      const data = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data?.error || 'Failed to create task');
      setQuickTitle('');
      setQuickDue('');
      setQuickAssigneeId('');
      setQuickPriority('none');
      setComposerOpen(false);
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const patchTask = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/staff/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await parseJsonResponse<StaffTask & { error?: string }>(res);
    if (!res.ok) throw new Error(data?.error || 'Update failed');
    return data;
  };

  const toggleComplete = async (task: StaffTask) => {
    setBusyTaskId(task.id);
    setError(null);
    try {
      if (task.status === 'done') {
        await patchTask(task.id, { action: 'reopen' });
      } else {
        await patchTask(task.id, { action: 'complete' });
      }
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyTaskId(null);
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    setError(null);
    try {
      const res = await fetch(`/api/staff/tasks/${id}`, { method: 'DELETE' });
      const data = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data?.error || 'Delete failed');
      if (editing?.id === id) setEditing(null);
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const openEdit = useCallback((task: StaffTask) => {
    setEditing(task);
    setEditForm({
      title: task.title,
      description: task.description || '',
      assigneeId: task.assigneeId || '',
      dueAt: toDateInputValue(task.dueAt),
      priority: task.priority,
      status: task.status,
    });
  }, []);

  useEffect(() => {
    if (loading || tasks.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('task');
    if (!taskId) return;
    const match = tasks.find((t) => t.id === taskId);
    if (match) openEdit(match);
  }, [loading, tasks, openEdit]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
        event.preventDefault();
        setSearchOpen(true);
      }
      if (
        (event.key === 'n' || event.key === 'N') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
        event.preventDefault();
        setComposerOpen(true);
        window.requestAnimationFrame(() => quickTitleRef.current?.focus());
      }
      if (event.key === 'Escape') {
        setStatusMenuOpen(false);
        setDueMenuOpen(false);
        if (composerOpen && !quickTitle.trim()) setComposerOpen(false);
        if (searchOpen && !searchQuery) setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [searchOpen, searchQuery, composerOpen, quickTitle]);

  useEffect(() => {
    if (!statusMenuOpen && !dueMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (statusMenuOpen && statusMenuRef.current && !statusMenuRef.current.contains(target)) {
        setStatusMenuOpen(false);
      }
      if (dueMenuOpen && dueMenuRef.current && !dueMenuRef.current.contains(target)) {
        setDueMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [statusMenuOpen, dueMenuOpen]);

  useEffect(() => {
    if (!composerOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (composerRef.current && !composerRef.current.contains(target) && !quickTitle.trim()) {
        setComposerOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [composerOpen, quickTitle]);

  const activeStat: TaskStatKey | null =
    dueFilter === 'overdue' && statusFilter === 'active'
      ? 'overdue'
      : statusFilter === 'done' && !dueFilter
        ? 'done'
        : null;

  const applyStatFilter = (key: TaskStatKey) => {
    if (key === 'overdue' && activeStat === 'overdue') {
      setDueFilter('');
      return;
    }
    if (key === 'done' && activeStat === 'done') {
      setStatusFilter('active');
      return;
    }
    if (key === 'open') {
      setStatusFilter('active');
      setDueFilter('');
      setScope('assigned_to_me');
      return;
    }
    if (key === 'overdue') {
      setStatusFilter('active');
      setDueFilter('overdue');
      setScope('assigned_to_me');
      return;
    }
    setStatusFilter('done');
    setDueFilter('');
    setScope('assigned_to_me');
  };

  const statusLabel =
    STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? 'Open';
  const dueLabel = DUE_OPTIONS.find((option) => option.value === dueFilter)?.label ?? 'Any due date';
  const filtersActive = Boolean(searchQuery.trim()) || statusFilter !== 'active' || Boolean(dueFilter);
  const composerExpanded =
    composerOpen || Boolean(quickTitle.trim()) || Boolean(quickDue) || quickPriority !== 'none';

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSubmitting(true);
    setError(null);
    try {
      await patchTask(editing.id, {
        title: editForm.title.trim(),
        description: editForm.description,
        assigneeId: editForm.assigneeId || null,
        dueAt: editForm.dueAt || null,
        priority: editForm.priority,
        status: editForm.status,
      });
      setEditing(null);
      await Promise.all([load(), loadStats()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const scopeTabs: { id: Scope; label: string; icon: typeof ListChecks }[] = [
    { id: 'assigned_to_me', label: 'My tasks', icon: ListChecks },
    { id: 'created_by_me', label: 'Assigned by me', icon: Send },
    ...(canViewAllTasks ? [{ id: 'all' as const, label: 'All tasks', icon: Users }] : []),
  ];

  const focusComposer = () => {
    setComposerOpen(true);
    window.requestAnimationFrame(() => quickTitleRef.current?.focus());
  };

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Plan my work"
        title="My tasks"
        description="Capture follow-ups, track deadlines, and keep work moving."
        icon={ClipboardList}
        actions={
          <StrideButton variant="primary" size="sm" onClick={focusComposer} className="shrink-0 gap-1.5">
            <Plus className="h-4 w-4" />
            New task
          </StrideButton>
        }
      />

      <TaskStatCards
        stats={stats}
        loading={statsLoading}
        active={activeStat}
        onSelect={applyStatFilter}
      />

      {error ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mb-4 flex w-fit max-w-full flex-wrap gap-1 rounded-2xl bg-neutral-100/90 p-1">
        {scopeTabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setScope(id)} className={TAB_CLASS(scope === id)}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
        <form
          ref={composerRef}
          onSubmit={createTask}
          className={`border-b border-neutral-100 bg-gradient-to-b from-neutral-50/80 to-white transition-colors ${
            composerExpanded ? 'from-primary-50/40' : ''
          }`}
        >
          <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                composerExpanded
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-neutral-100 text-neutral-400'
              }`}
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <input
              ref={quickTitleRef}
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onFocus={() => setComposerOpen(true)}
              id="quick-add-title"
              placeholder="What needs to be done?"
              className="h-10 min-w-0 flex-1 border-0 bg-transparent text-sm text-primary-950 placeholder:text-neutral-400 focus:outline-none"
            />
            <StrideButton
              variant="primary"
              type="submit"
              disabled={submitting || !quickTitle.trim()}
              size="sm"
              className="h-9 shrink-0 px-3.5 text-sm"
            >
              {submitting ? 'Adding…' : 'Add'}
            </StrideButton>
          </div>

          <div
            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
              composerExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="grid grid-cols-1 gap-2 border-t border-neutral-100/80 px-3 pb-3 pt-2 sm:grid-cols-3 sm:px-4 sm:pl-[3.25rem]">
                <StrideSelect
                  value={quickAssigneeId}
                  onChange={setQuickAssigneeId}
                  options={[
                    { value: '', label: 'Assign to me' },
                    ...assignees
                      .filter((a) => a.id !== currentUserId)
                      .map((a) => ({ value: a.id, label: a.name })),
                  ]}
                  placeholder="Assign to me"
                  className="w-full"
                />
                <input
                  type="date"
                  value={quickDue}
                  onChange={(e) => setQuickDue(e.target.value)}
                  className={INPUT_CLASS}
                  aria-label="Due date"
                />
                <StrideSelect
                  value={quickPriority}
                  onChange={(value) => setQuickPriority(value as StaffTask['priority'])}
                  options={[
                    { value: 'none', label: 'No priority' },
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                  ]}
                  placeholder="Priority"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-3 py-2.5 sm:px-4">
          <div
            className={`flex items-center overflow-hidden rounded-xl border bg-white transition-[width,box-shadow,border-color] duration-200 ${
              searchOpen || searchQuery
                ? 'min-w-[12rem] flex-1 border-primary-300 ring-2 ring-primary-500/10 sm:max-w-xs'
                : 'border-transparent hover:border-neutral-200'
            }`}
          >
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-neutral-400 hover:text-primary-900"
              aria-label="Search tasks"
              title="Search (/)"
            >
              <Search className="h-4 w-4" />
            </button>
            {searchOpen || searchQuery ? (
              <>
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => {
                    if (!searchQuery.trim()) setSearchOpen(false);
                  }}
                  placeholder="Search tasks, people…"
                  className="h-9 min-w-0 flex-1 border-0 bg-transparent pr-2 text-sm text-primary-900 placeholder:text-neutral-400 focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchOpen(false);
                    }}
                    className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <kbd className="mr-2 hidden rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400 sm:inline">
                    /
                  </kbd>
                )}
              </>
            ) : null}
          </div>

          <div className="relative" ref={statusMenuRef}>
            <button
              type="button"
              onClick={() => {
                setStatusMenuOpen((open) => !open);
                setDueMenuOpen(false);
              }}
              aria-expanded={statusMenuOpen}
              aria-haspopup="listbox"
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-sm font-semibold transition-colors ${
                statusFilter !== 'active'
                  ? 'border-primary-300 bg-primary-50 text-primary-900'
                  : 'border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <ListChecks className="h-3.5 w-3.5" />
              {statusLabel}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>
            {statusMenuOpen ? (
              <div
                role="listbox"
                aria-label="Status filter"
                className="absolute left-0 z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
              >
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={statusFilter === option.value}
                    onClick={() => {
                      setStatusFilter(option.value);
                      setStatusMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                      statusFilter === option.value
                        ? 'bg-primary-50 font-semibold text-primary-900'
                        : 'text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {option.label}
                    {statusFilter === option.value ? <Check className="h-3.5 w-3.5" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative" ref={dueMenuRef}>
            <button
              type="button"
              onClick={() => {
                setDueMenuOpen((open) => !open);
                setStatusMenuOpen(false);
              }}
              aria-expanded={dueMenuOpen}
              aria-haspopup="listbox"
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-sm font-semibold transition-colors ${
                dueFilter
                  ? dueFilter === 'overdue'
                    ? 'border-red-300 bg-red-50 text-red-900'
                    : 'border-primary-300 bg-primary-50 text-primary-900'
                  : 'border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {dueFilter ? dueLabel : 'Due'}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>
            {dueMenuOpen ? (
              <div
                role="listbox"
                aria-label="Due date filter"
                className="absolute left-0 z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
              >
                {DUE_OPTIONS.map((option) => (
                  <button
                    key={option.value || 'any'}
                    type="button"
                    role="option"
                    aria-selected={dueFilter === option.value}
                    onClick={() => {
                      setDueFilter(option.value);
                      setDueMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                      dueFilter === option.value
                        ? 'bg-primary-50 font-semibold text-primary-900'
                        : 'text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {option.label}
                    {dueFilter === option.value ? <Check className="h-3.5 w-3.5" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchOpen(false);
                setStatusFilter('active');
                setDueFilter('');
              }}
              className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 hover:text-primary-900"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          ) : null}

          <p className="ml-auto text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            {loading ? null : `${filteredTasks.length} task${filteredTasks.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {loading ? (
          <div className="px-4 py-8">
            <DashboardPageSkeleton variant="list" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="px-6 py-16 text-center sm:py-20">
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
              <Inbox className="h-7 w-7" strokeWidth={1.5} />
            </div>
            <p className="mb-1 text-base font-semibold text-primary-900">
              {searchQuery || filtersActive ? 'No tasks match' : 'Clear desk'}
            </p>
            <p className="mx-auto mb-6 max-w-sm text-sm text-neutral-500">
              {searchQuery || filtersActive
                ? 'Try a different search or clear filters.'
                : 'Nothing here yet. Capture a follow-up before it slips.'}
            </p>
            {!searchQuery && !filtersActive ? (
              <StrideButton variant="primary" onClick={focusComposer} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add your first task
              </StrideButton>
            ) : null}
          </div>
        ) : (
          <div>
            {taskGroups.map((group) => (
              <div key={group.key}>
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-neutral-100 bg-white/95 px-4 py-1.5 backdrop-blur-sm sm:px-5">
                  <p
                    className={`text-[11px] font-bold uppercase tracking-widest ${
                      group.key === 'overdue'
                        ? 'text-red-700'
                        : group.key === 'today'
                          ? 'text-secondary-800'
                          : group.key === 'done'
                            ? 'text-emerald-700'
                            : 'text-neutral-500'
                    }`}
                  >
                    {group.label}
                  </p>
                  <span className="text-[11px] font-semibold tabular-nums text-neutral-400">
                    {group.tasks.length}
                  </span>
                </div>
                <ul>
                  {group.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      scope={scope}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      busy={busyTaskId === task.id}
                      highlighted={highlightedTaskId === task.id}
                      variant="row"
                      onToggleComplete={toggleComplete}
                      onEdit={openEdit}
                      onDelete={deleteTask}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {editing ? (
        <TaskEditModal
          assignees={assignees}
          form={editForm}
          submitting={submitting}
          onClose={() => setEditing(null)}
          onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
          onSubmit={saveEdit}
        />
      ) : null}
    </DashboardPage>
  );
}
