'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  ListChecks,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SalesEmptyState, SalesFilterBar, SalesStageBadge, type FilterSelect } from '@/components/dashboard/sales';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import { formatShortDate } from '@/lib/sales/format';
import { apiFetch, salesKeys, useSalesResource } from '@/lib/sales/hooks';

type TaskItem = {
  id: string;
  title: string;
  notes: string | null;
  status: 'open' | 'completed' | 'cancelled';
  type: string;
  dueDate: string | null;
  completedAt: string | null;
  assigneeEmployeeId: string | null;
  assignee: { id: string; name: string } | null;
  dealId: string | null;
  deal: { id: string; name: string; stage: string } | null;
  contactId: string | null;
  contact: { id: string; name: string } | null;
};

type Rep = { id: string; name: string; email: string | null };

type Tab = 'open' | 'overdue' | 'completed' | 'all';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
  { id: 'all', label: 'All' },
];

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function isOverdue(t: TaskItem): boolean {
  return t.status === 'open' && !!t.dueDate && new Date(t.dueDate) < startOfToday();
}

type Bucket = { key: string; label: string; tasks: TaskItem[] };

function bucketByDue(tasks: TaskItem[]): Bucket[] {
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 86400000);
  const weekEnd = new Date(today.getTime() + 7 * 86400000);
  const buckets: Record<string, Bucket> = {
    overdue: { key: 'overdue', label: 'Overdue', tasks: [] },
    today: { key: 'today', label: 'Today', tasks: [] },
    week: { key: 'week', label: 'This week', tasks: [] },
    later: { key: 'later', label: 'Later', tasks: [] },
    none: { key: 'none', label: 'No due date', tasks: [] },
  };
  for (const t of tasks) {
    if (!t.dueDate) buckets.none.tasks.push(t);
    else {
      const d = new Date(t.dueDate);
      if (d < today) buckets.overdue.tasks.push(t);
      else if (d < tomorrow) buckets.today.tasks.push(t);
      else if (d < weekEnd) buckets.week.tasks.push(t);
      else buckets.later.tasks.push(t);
    }
  }
  return Object.values(buckets).filter((b) => b.tasks.length > 0);
}

export default function SalesTasksContent() {
  const queryClient = useQueryClient();
  const tasksQuery = useSalesResource<{ tasks: TaskItem[] }>(salesKeys.tasks(), '/api/sales/tasks');
  const repsQuery = useSalesResource<{ employees: Rep[] }>(salesKeys.reps(), '/api/sales/reps');
  const tasks = useMemo(() => tasksQuery.data?.tasks ?? [], [tasksQuery.data]);
  const reps = repsQuery.data?.employees ?? [];

  const [tab, setTab] = useState<Tab>('open');
  const [search, setSearch] = useState('');
  const [assignee, setAssignee] = useState('all');
  const [linked, setLinked] = useState<'all' | 'deal' | 'standalone'>('all');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: salesKeys.tasks() });
    await queryClient.invalidateQueries({ queryKey: salesKeys.all });
  }, [queryClient]);

  const counts = useMemo(
    () => ({
      open: tasks.filter((t) => t.status === 'open').length,
      overdue: tasks.filter(isOverdue).length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      all: tasks.length,
    }),
    [tasks],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (tab === 'open' && t.status !== 'open') return false;
      if (tab === 'overdue' && !isOverdue(t)) return false;
      if (tab === 'completed' && t.status !== 'completed') return false;
      if (assignee !== 'all' && t.assigneeEmployeeId !== assignee) return false;
      if (linked === 'deal' && !t.dealId) return false;
      if (linked === 'standalone' && t.dealId) return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, tab, assignee, linked, search]);

  const grouped = useMemo(() => {
    if (tab === 'completed') {
      const sorted = [...filtered].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
      return [{ key: 'completed', label: 'Completed', tasks: sorted }];
    }
    return bucketByDue(filtered);
  }, [filtered, tab]);

  async function toggle(task: TaskItem) {
    setBusyId(task.id);
    try {
      await apiFetch(`/api/sales/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: task.status === 'completed' ? 'open' : 'completed' }),
      });
      toast.success(task.status === 'completed' ? 'Task reopened.' : 'Task completed.');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update task');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/api/sales/tasks/${id}`, { method: 'DELETE' });
      toast.success('Task deleted.');
      setDeleteId(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete task');
    } finally {
      setBusyId(null);
    }
  }

  const filterSelects: FilterSelect[] = [
    {
      id: 'assignee',
      value: assignee,
      ariaLabel: 'Filter by assignee',
      options: [{ value: 'all', label: 'All assignees' }, ...reps.map((r) => ({ value: r.id, label: r.name }))],
      onChange: setAssignee,
    },
    {
      id: 'linked',
      value: linked,
      ariaLabel: 'Filter by link',
      options: [
        { value: 'all', label: 'All tasks' },
        { value: 'deal', label: 'Linked to deal' },
        { value: 'standalone', label: 'Standalone' },
      ],
      onChange: (v) => setLinked(v as 'all' | 'deal' | 'standalone'),
    },
  ];

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Sales tasks"
        description="Your follow-up inbox across deals, leads, and contacts."
        icon={ListChecks}
        actions={
          <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Add task
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-[var(--dash-border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-[var(--stride-coral)] text-[var(--dash-text-strong)]'
                : 'border-transparent text-[var(--dash-text-muted)] hover:text-[var(--dash-text-strong)]'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${t.id === 'overdue' && counts.overdue > 0 ? 'bg-red-100 text-red-700' : 'bg-[var(--dash-surface-muted)] text-[var(--dash-text-muted)]'}`}>
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      <SalesFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search tasks…"
        selects={filterSelects}
        resultCount={filtered.length}
      />

      {tasksQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--dash-surface-muted)]" />
          ))}
        </div>
      ) : tasksQuery.isError ? (
        <div className="dashboard-surface flex flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="text-sm text-[var(--dash-text-strong)]">{tasksQuery.error?.message ?? 'Failed to load tasks.'}</p>
          <button type="button" onClick={() => tasksQuery.refetch()} className="btn-secondary px-4 py-2 text-sm">
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <SalesEmptyState
          icon={ListChecks}
          title={tab === 'completed' ? 'No completed tasks' : 'You’re all caught up'}
          description={tab === 'overdue' ? 'No overdue tasks — nice work.' : 'Create a follow-up task to stay on top of your pipeline.'}
          action={
            <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Add task
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((bucket) => (
            <section key={bucket.key}>
              <h2 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${bucket.key === 'overdue' ? 'text-red-600' : 'text-[var(--dash-text-muted)]'}`}>
                {bucket.label} <span className="text-[var(--dash-text-muted)]">({bucket.tasks.length})</span>
              </h2>
              <ul className="space-y-2">
                {bucket.tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    overdue={isOverdue(t)}
                    busy={busyId === t.id}
                    onToggle={() => void toggle(t)}
                    onDelete={() => setDeleteId(t.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {createOpen ? (
        <CreateTaskModal
          reps={reps}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            toast.success('Task created.');
            await refresh();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete task"
        tone="danger"
        confirmLabel="Delete"
        loading={busyId === deleteId}
        description="This task will be permanently removed."
        onConfirm={() => deleteId && void remove(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </DashboardPage>
  );
}

function TaskRow({
  task,
  overdue,
  busy,
  onToggle,
  onDelete,
}: {
  task: TaskItem;
  overdue: boolean;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const done = task.status === 'completed';
  return (
    <li
      className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        overdue ? 'border-red-300/70 bg-red-50/40 dark:bg-red-950/10' : 'border-[var(--dash-border)] bg-[var(--dash-surface-solid)]'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-label={done ? 'Reopen task' : 'Complete task'}
        className="shrink-0 text-[var(--dash-text-muted)] hover:text-[var(--stride-coral)] disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${done ? 'text-[var(--dash-text-muted)] line-through' : 'font-medium text-[var(--dash-text-strong)]'}`}>
          {task.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--dash-text-muted)]">
          {task.deal ? (
            <Link href="/dashboard/sales/deals" className="inline-flex items-center gap-1 hover:text-[var(--stride-coral)]">
              <SalesStageBadge stage={task.deal.stage} />
              <span className="max-w-[12rem] truncate">{task.deal.name}</span>
            </Link>
          ) : task.contact ? (
            <span className="truncate">{task.contact.name}</span>
          ) : null}
          {task.assignee ? <span>· {task.assignee.name}</span> : null}
        </div>
      </div>
      {task.dueDate ? (
        <span className={`inline-flex shrink-0 items-center gap-1 text-xs ${overdue ? 'font-medium text-red-600' : 'text-[var(--dash-text-muted)]'}`}>
          <CalendarClock className="h-3.5 w-3.5" /> {formatShortDate(task.dueDate)}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete task"
        className="shrink-0 rounded p-1 text-[var(--dash-text-muted)] opacity-0 transition-opacity hover:bg-[var(--dash-hover)] hover:text-red-600 group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function CreateTaskModal({
  reps,
  onClose,
  onCreated,
}: {
  reps: Rep[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [assignee, setAssignee] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await apiFetch('/api/sales/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          dueDate: due || undefined,
          assigneeEmployeeId: assignee || undefined,
        }),
      });
      await onCreated();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-5 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-[var(--stride-coral)]" />
          <h2 className="text-lg font-semibold text-[var(--dash-text-strong)]">New task</h2>
        </div>
        <label className="block text-xs text-[var(--dash-text-muted)]">
          <span className="mb-1 block">Title</span>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="dash-auth-input w-full" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs text-[var(--dash-text-muted)]">
            <span className="mb-1 block">Due date</span>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="dash-auth-input w-full" />
          </label>
          <label className="block text-xs text-[var(--dash-text-muted)]">
            <span className="mb-1 block">Assignee</span>
            <StrideSelect
              value={assignee}
              onChange={setAssignee}
              options={[{ value: '', label: 'Unassigned' }, ...reps.map((r) => ({ value: r.id, label: r.name }))]}
              ariaLabel="Assignee"
            />
          </label>
        </div>
        {err ? <p className="mt-3 text-xs text-red-600">{err}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-3 py-2 text-sm">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Create task'}
          </button>
        </div>
      </form>
    </div>
  );
}
