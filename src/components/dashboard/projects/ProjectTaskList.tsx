'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Plus, Search, X } from 'lucide-react';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import type { MilestoneDTO, TaskDTO } from '@/types/projects';
import type { ProjectTaskStatus } from '@/types/projects';
import {
  TASK_COLUMNS,
  TASK_STATUS_STYLES,
  PRIORITY_DOT,
  PRIORITY_LABEL,
  isOverdue,
} from '@/app/dashboard/(app)/projects/_lib/constants';
import {
  compareTasks,
  loadSavedViews,
  persistSavedViews,
  type ListGroupBy,
  type ListSortBy,
  type SavedListView,
} from '@/app/dashboard/(app)/projects/_lib/timeline';

export type ProjectTaskListProps = {
  projectId: string;
  tasks: TaskDTO[];
  milestones: MilestoneDTO[];
  people?: { id: string; name: string }[];
  onTaskClick: (taskId: string) => void;
  onQuickAdd: (title: string) => void | Promise<void>;
  onStatusChange?: (taskId: string, status: ProjectTaskStatus) => void | Promise<void>;
};

export function ProjectTaskList({
  projectId,
  tasks,
  milestones,
  people = [],
  onTaskClick,
  onQuickAdd,
  onStatusChange,
}: ProjectTaskListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [groupBy, setGroupBy] = useState<ListGroupBy>('milestone');
  const [sortBy, setSortBy] = useState<ListSortBy>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [hideDone, setHideDone] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [savedViews, setSavedViews] = useState<SavedListView[]>([]);
  const [viewName, setViewName] = useState('');
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    setSavedViews(loadSavedViews(projectId));
  }, [projectId]);

  const topTasks = useMemo(() => tasks.filter((t) => !t.parentTaskId), [tasks]);

  const filtered = useMemo(() => {
    let list = [...topTasks];
    if (hideDone) list = list.filter((t) => t.status !== 'done');
    if (statusFilter) list = list.filter((t) => t.status === statusFilter);
    if (assigneeFilter) {
      list = list.filter((t) =>
        assigneeFilter === '__none__' ? !t.assignee : t.assignee?.id === assigneeFilter,
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q) ||
          (t.assignee?.name ?? '').toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => compareTasks(a, b, sortBy, sortDir));
    return list;
  }, [topTasks, hideDone, statusFilter, assigneeFilter, search, sortBy, sortDir]);

  const groups = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: 'All tasks', tasks: filtered }];
    }
    const map = new Map<string, { key: string; label: string; tasks: TaskDTO[] }>();
    const ensure = (key: string, label: string) => {
      if (!map.has(key)) map.set(key, { key, label, tasks: [] });
      return map.get(key)!;
    };

    if (groupBy === 'milestone') {
      for (const m of milestones) ensure(m.id, m.title);
      ensure('none', 'No milestone');
      for (const t of filtered) {
        ensure(t.milestoneId ?? 'none', t.milestone?.title ?? 'No milestone').tasks.push(t);
      }
    } else if (groupBy === 'status') {
      for (const c of TASK_COLUMNS) ensure(c.key, c.label);
      for (const t of filtered) ensure(t.status, t.status.replace('_', ' ')).tasks.push(t);
    } else if (groupBy === 'priority') {
      for (const p of ['high', 'medium', 'low'] as const) ensure(p, PRIORITY_LABEL[p]);
      for (const t of filtered) ensure(t.priority, PRIORITY_LABEL[t.priority]).tasks.push(t);
    } else {
      ensure('none', 'Unassigned');
      for (const t of filtered) {
        if (t.assignee) ensure(t.assignee.id, t.assignee.name).tasks.push(t);
        else ensure('none', 'Unassigned').tasks.push(t);
      }
    }

    return [...map.values()].filter((g) => g.tasks.length > 0 || groupBy === 'milestone');
  }, [filtered, groupBy, milestones]);

  function applyView(view: SavedListView) {
    setGroupBy(view.groupBy);
    setSortBy(view.sortBy);
    setSortDir(view.sortDir);
    setStatusFilter(view.statusFilter);
    setAssigneeFilter(view.assigneeFilter);
    setSearch(view.search);
    setHideDone(view.hideDone);
    toast.success(`Applied “${view.name}”`);
  }

  function saveCurrentView() {
    if (!viewName.trim()) return;
    const view: SavedListView = {
      id: `${Date.now()}`,
      name: viewName.trim(),
      groupBy,
      sortBy,
      sortDir,
      statusFilter,
      assigneeFilter,
      search,
      hideDone,
    };
    const next = [...savedViews.filter((v) => v.name !== view.name), view];
    setSavedViews(next);
    persistSavedViews(projectId, next);
    setViewName('');
    setShowSave(false);
    toast.success('View saved');
  }

  function deleteView(id: string) {
    const next = savedViews.filter((v) => v.id !== id);
    setSavedViews(next);
    persistSavedViews(projectId, next);
  }

  async function submitQuick(e: React.FormEvent) {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    await onQuickAdd(quickTitle.trim());
    setQuickTitle('');
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dash-text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="dash-auth-input w-full pl-8 text-sm"
            />
          </div>
          <StrideSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: 'All statuses' },
              ...TASK_COLUMNS.map((c) => ({ value: c.key, label: c.label })),
            ]}
            ariaLabel="Status filter"
            className="min-w-[9rem]"
            size="sm"
          />
          <StrideSelect
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            options={[
              { value: '', label: 'All assignees' },
              { value: '__none__', label: 'Unassigned' },
              ...people.map((p) => ({ value: p.id, label: p.name })),
            ]}
            ariaLabel="Assignee filter"
            className="min-w-[9rem]"
            size="sm"
          />
          <StrideSelect
            value={groupBy}
            onChange={(v) => setGroupBy(v as ListGroupBy)}
            options={[
              { value: 'milestone', label: 'Group: Milestone' },
              { value: 'status', label: 'Group: Status' },
              { value: 'assignee', label: 'Group: Assignee' },
              { value: 'priority', label: 'Group: Priority' },
              { value: 'none', label: 'No grouping' },
            ]}
            ariaLabel="Group by"
            className="min-w-[10rem]"
            size="sm"
          />
          <StrideSelect
            value={`${sortBy}:${sortDir}`}
            onChange={(v) => {
              const [s, d] = v.split(':') as [ListSortBy, 'asc' | 'desc'];
              setSortBy(s);
              setSortDir(d);
            }}
            options={[
              { value: 'dueDate:asc', label: 'Due ↑' },
              { value: 'dueDate:desc', label: 'Due ↓' },
              { value: 'priority:asc', label: 'Priority ↑' },
              { value: 'priority:desc', label: 'Priority ↓' },
              { value: 'status:asc', label: 'Status ↑' },
              { value: 'title:asc', label: 'Title A–Z' },
              { value: 'updatedAt:desc', label: 'Recently updated' },
            ]}
            ariaLabel="Sort"
            className="min-w-[9rem]"
            size="sm"
          />
          <label className="inline-flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)]">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(e) => setHideDone(e.target.checked)}
              className="rounded"
            />
            Hide done
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {savedViews.map((v) => (
            <span
              key={v.id}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] pl-2.5 text-xs"
            >
              <button type="button" onClick={() => applyView(v)} className="py-1 font-medium text-[var(--dash-text-strong)] hover:underline">
                {v.name}
              </button>
              <button
                type="button"
                onClick={() => deleteView(v.id)}
                className="rounded-full p-1 text-[var(--dash-text-muted)] hover:text-red-600"
                aria-label={`Delete view ${v.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {showSave ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveCurrentView();
              }}
              className="inline-flex items-center gap-1"
            >
              <input
                autoFocus
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="View name"
                className="dash-auth-input h-8 w-32 text-xs"
              />
              <button type="submit" className="btn-primary h-8 px-2 text-xs">
                Save
              </button>
              <button type="button" onClick={() => setShowSave(false)} className="text-xs text-[var(--dash-text-muted)]">
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowSave(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--dash-border)] px-2 py-1 text-xs font-medium text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
            >
              <Bookmark className="h-3 w-3" />
              Save view
            </button>
          )}
          <span className="ml-auto text-xs text-[var(--dash-text-muted)]">
            {filtered.length} task{filtered.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <form onSubmit={(e) => void submitQuick(e)} className="flex gap-2">
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Quick-add task…"
          className="dash-auth-input flex-1 text-sm"
        />
        <button type="submit" className="btn-primary inline-flex items-center gap-1 px-3 py-2 text-sm">
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>

      {groups.map((group) => (
        <section
          key={group.key}
          className="overflow-hidden rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)]"
        >
          <h3 className="flex items-center justify-between border-b border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
            <span>{group.label}</span>
            <span className="font-normal normal-case">{group.tasks.length}</span>
          </h3>
          {!group.tasks.length ? (
            <p className="px-4 py-6 text-sm text-[var(--dash-text-muted)]">No tasks in this group.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {group.tasks.map((t) => {
                  const overdue = isOverdue(t.dueDate, t.status);
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-[var(--dash-border-subtle)] last:border-0 hover:bg-[var(--dash-hover)]"
                    >
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => onTaskClick(t.id)}
                          className="flex items-center gap-2 text-left font-medium text-[var(--dash-text-strong)] hover:underline"
                        >
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`}
                          />
                          {t.title}
                          {(t.subtaskCount ?? 0) > 0 ? (
                            <span className="text-[10px] font-normal text-[var(--dash-text-muted)]">
                              {t.subtasks?.filter((s) => s.status === 'done').length ?? 0}/
                              {t.subtaskCount}
                            </span>
                          ) : null}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        {onStatusChange ? (
                          <StrideSelect
                            value={t.status}
                            onChange={(v) => void onStatusChange(t.id, v as ProjectTaskStatus)}
                            options={TASK_COLUMNS.map((c) => ({ value: c.key, label: c.label }))}
                            ariaLabel="Status"
                            className="min-w-[7rem]"
                            size="sm"
                          />
                        ) : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs capitalize ${TASK_STATUS_STYLES[t.status]}`}
                          >
                            {t.status.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize text-[var(--dash-text-muted)]">
                        {t.priority}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--dash-text-muted)]">
                        {t.assignee?.name ?? '—'}
                      </td>
                      <td
                        className={`px-4 py-2.5 tabular-nums ${
                          overdue ? 'font-medium text-red-600' : 'text-[var(--dash-text-muted)]'
                        }`}
                      >
                        {t.dueDate ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {!filtered.length ? (
        <p className="py-10 text-center text-sm text-[var(--dash-text-muted)]">
          No tasks match these filters.
        </p>
      ) : null}
    </div>
  );
}
