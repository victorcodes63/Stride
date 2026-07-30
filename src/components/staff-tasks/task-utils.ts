import type { StaffTask } from './types';

export const PRIORITY_LABEL: Record<StaffTask['priority'], string> = {
  none: '',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const PRIORITY_CLASS: Record<StaffTask['priority'], string> = {
  none: '',
  low: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  medium: 'bg-amber-50 text-amber-900 ring-amber-200',
  high: 'bg-red-50 text-red-800 ring-red-200',
};

export const STATUS_LABEL: Record<StaffTask['status'], string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export const STATUS_CLASS: Record<StaffTask['status'], string> = {
  todo: 'bg-neutral-100 text-neutral-700',
  in_progress: 'bg-primary-50 text-primary-800',
  done: 'bg-green-50 text-green-800',
};

export function formatDue(dueAt: string | null): string {
  if (!dueAt) return '';
  const d = new Date(dueAt);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function isOverdue(task: StaffTask): boolean {
  if (!task.dueAt || task.status === 'done') return false;
  const due = new Date(task.dueAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function isDueToday(task: StaffTask): boolean {
  if (!task.dueAt) return false;
  const due = new Date(task.dueAt);
  const today = new Date();
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

export function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function sortTasksForDisplay(tasks: StaffTask[]): StaffTask[] {
  const rank = (t: StaffTask) => {
    if (t.status === 'done') return 3;
    if (isOverdue(t)) return 0;
    if (isDueToday(t)) return 1;
    return 2;
  };
  return [...tasks].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    const da = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const db = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export type TaskGroupKey = 'overdue' | 'today' | 'upcoming' | 'nodate' | 'done';

export type TaskGroup = {
  key: TaskGroupKey;
  label: string;
  tasks: StaffTask[];
};

const GROUP_ORDER: TaskGroupKey[] = ['overdue', 'today', 'upcoming', 'nodate', 'done'];

const GROUP_LABEL: Record<TaskGroupKey, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  upcoming: 'Upcoming',
  nodate: 'No due date',
  done: 'Completed',
};

export function groupTasksForDisplay(tasks: StaffTask[]): TaskGroup[] {
  const sorted = sortTasksForDisplay(tasks);
  const buckets: Record<TaskGroupKey, StaffTask[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    nodate: [],
    done: [],
  };

  for (const task of sorted) {
    if (task.status === 'done') {
      buckets.done.push(task);
    } else if (isOverdue(task)) {
      buckets.overdue.push(task);
    } else if (isDueToday(task)) {
      buckets.today.push(task);
    } else if (task.dueAt) {
      buckets.upcoming.push(task);
    } else {
      buckets.nodate.push(task);
    }
  }

  return GROUP_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({
    key,
    label: GROUP_LABEL[key],
    tasks: buckets[key],
  }));
}

export const INPUT_CLASS =
  'w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-primary-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500 transition-shadow';

export const TAB_CLASS = (active: boolean) =>
  `inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
    active
      ? 'bg-white text-primary-900 shadow-sm ring-1 ring-neutral-200/90'
      : 'text-neutral-600 hover:text-primary-900 hover:bg-white/60'
  }`;
