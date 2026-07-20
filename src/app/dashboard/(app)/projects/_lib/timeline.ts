/** Pure helpers for project timeline / Gantt positioning. */

export type TimelineRange = {
  start: Date;
  end: Date;
  /** Inclusive day count. */
  dayCount: number;
};

export function parseDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function diffDays(a: Date, b: Date): number {
  const ms = toDateKey(b) === toDateKey(a)
    ? 0
    : Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
      Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86_400_000);
}

/**
 * Build a timeline range covering project + milestone + task dates,
 * with padding. Falls back to today ± 14 days when nothing is dated.
 */
export function buildTimelineRange(dates: Array<string | null | undefined>, padDays = 3): TimelineRange {
  const parsed = dates.map(parseDateOnly).filter((d): d is Date => d != null);
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  let start = today;
  let end = addDays(today, 28);

  if (parsed.length) {
    const times = parsed.map((d) => d.getTime());
    start = new Date(Math.min(...times));
    end = new Date(Math.max(...times));
    if (diffDays(start, end) < 7) end = addDays(start, 14);
  }

  start = addDays(start, -padDays);
  end = addDays(end, padDays);

  return {
    start,
    end,
    dayCount: Math.max(1, diffDays(start, end) + 1),
  };
}

export function enumerateDays(range: TimelineRange): string[] {
  const days: string[] = [];
  for (let i = 0; i < range.dayCount; i++) {
    days.push(toDateKey(addDays(range.start, i)));
  }
  return days;
}

export type BarLayout = {
  leftPct: number;
  widthPct: number;
  /** True when the item has no dates and we show a placeholder near start. */
  undated: boolean;
};

/**
 * Position a bar within [rangeStart, rangeEnd].
 * Uses startDate/dueDate; if only one is set, spans a single day.
 * Undated items get a thin placeholder at the range start.
 */
export function layoutBar(
  range: TimelineRange,
  startDate: string | null | undefined,
  dueDate: string | null | undefined,
): BarLayout {
  const start = parseDateOnly(startDate) ?? parseDateOnly(dueDate);
  const end = parseDateOnly(dueDate) ?? parseDateOnly(startDate);

  if (!start || !end) {
    return { leftPct: 0, widthPct: Math.min(4, 100 / range.dayCount), undated: true };
  }

  const rawStart = Math.max(0, diffDays(range.start, start));
  const rawEnd = Math.min(range.dayCount - 1, diffDays(range.start, end));
  const left = Math.min(rawStart, rawEnd);
  const right = Math.max(rawStart, rawEnd);
  const span = Math.max(1, right - left + 1);

  return {
    leftPct: (left / range.dayCount) * 100,
    widthPct: Math.max((span / range.dayCount) * 100, 100 / range.dayCount),
    undated: false,
  };
}

export function monthMatrix(year: number, month: number): (string | null)[][] {
  // month is 0-indexed
  const first = new Date(year, month, 1, 12);
  const startPad = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toDateKey(new Date(year, month, d, 12)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export type ListGroupBy = 'milestone' | 'status' | 'assignee' | 'priority' | 'none';
export type ListSortBy = 'dueDate' | 'priority' | 'status' | 'title' | 'updatedAt';

export type SavedListView = {
  id: string;
  name: string;
  groupBy: ListGroupBy;
  sortBy: ListSortBy;
  sortDir: 'asc' | 'desc';
  statusFilter: string;
  assigneeFilter: string;
  search: string;
  hideDone: boolean;
};

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const STATUS_RANK: Record<string, number> = {
  backlog: 0,
  todo: 1,
  in_progress: 2,
  blocked: 3,
  done: 4,
};

export function compareTasks(
  a: {
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    updatedAt?: string;
  },
  b: typeof a,
  sortBy: ListSortBy,
  sortDir: 'asc' | 'desc',
): number {
  let cmp = 0;
  switch (sortBy) {
    case 'priority':
      cmp = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      break;
    case 'status':
      cmp = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
      break;
    case 'dueDate': {
      const ad = a.dueDate ?? '9999-99-99';
      const bd = b.dueDate ?? '9999-99-99';
      cmp = ad.localeCompare(bd);
      break;
    }
    case 'updatedAt':
      cmp = (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '');
      break;
    default:
      cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  }
  return sortDir === 'desc' ? -cmp : cmp;
}

export function loadSavedViews(projectId: string): SavedListView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`stride.projects.${projectId}.listViews`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedListView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistSavedViews(projectId: string, views: SavedListView[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`stride.projects.${projectId}.listViews`, JSON.stringify(views));
}
