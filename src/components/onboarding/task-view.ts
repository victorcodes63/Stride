import type { DashStatusTone } from '@/lib/dashboard-status-chips';

export type TaskPerson = { id: string; name: string; email: string };

export type TaskEmployee = { id: string; firstName: string; lastName: string };

export type TaskRow = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  assignedRole: string;
  category?: string | null;
  isRequired?: boolean;
  priority?: string;
  recurrence?: string;
  recurrenceEndsAt?: string | null;
  notes?: string | null;
  order?: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt?: string | null;
  documentId?: string | null;
  document?: { id: string; fileName: string; title: string } | null;
  assignedTo?: TaskPerson | null;
  completedBy?: TaskPerson | null;
  /** Operational tasks may reference an employee directly (not via a workflow). */
  employee?: TaskEmployee | null;
  workflow: {
    id: string;
    type: string;
    title?: string | null;
    employee?: TaskEmployee | null;
  };
};

export function isOperational(task: TaskRow): boolean {
  return task.workflow.type === 'OPERATIONAL';
}

/** The employee a task concerns: the workflow participant, or an operational link. */
export function taskEmployee(task: TaskRow): TaskEmployee | null {
  return task.workflow.employee ?? task.employee ?? null;
}

export const OPEN_STATUSES = ['PENDING', 'IN_PROGRESS', 'OVERDUE'];
export const CLOSED_STATUSES = ['COMPLETED', 'SKIPPED'];

export function isOpen(task: TaskRow): boolean {
  return !CLOSED_STATUSES.includes(task.status);
}

export function isOverdue(task: TaskRow): boolean {
  if (!task.dueDate || !isOpen(task)) return false;
  if (task.status === 'OVERDUE') return true;
  return new Date(task.dueDate) < new Date();
}

export function isUnassigned(task: TaskRow): boolean {
  return !task.assignedTo?.id;
}

export function taskStatusTone(status: string): DashStatusTone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'OVERDUE') return 'danger';
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'SKIPPED') return 'neutral';
  return 'warning';
}

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function workflowTypeLabel(type: string): string {
  if (type === 'ONBOARDING') return 'Onboarding';
  if (type === 'OFFBOARDING') return 'Offboarding';
  if (type === 'OPERATIONAL') return 'Operational';
  return type;
}

export type TaskPriorityMeta = {
  label: string;
  tone: DashStatusTone;
  dot: string;
};

export function priorityMeta(priority: string | undefined): TaskPriorityMeta {
  switch ((priority ?? 'MEDIUM').toUpperCase()) {
    case 'URGENT':
      return { label: 'Urgent', tone: 'danger', dot: '#e11d48' };
    case 'HIGH':
      return { label: 'High', tone: 'warning', dot: '#d97706' };
    case 'LOW':
      return { label: 'Low', tone: 'neutral', dot: '#9ca3af' };
    default:
      return { label: 'Medium', tone: 'info', dot: '#2563eb' };
  }
}

export function recurrenceLabel(recurrence: string | undefined): string | null {
  switch ((recurrence ?? 'NONE').toUpperCase()) {
    case 'DAILY':
      return 'Repeats daily';
    case 'WEEKLY':
      return 'Repeats weekly';
    case 'MONTHLY':
      return 'Repeats monthly';
    default:
      return null;
  }
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    hr: 'HR',
    it: 'IT',
    admin: 'Admin',
    department_head: 'Dept. head',
    finance: 'Finance',
  };
  return map[role] ?? role.replace(/_/g, ' ');
}

const MS_PER_DAY = 86_400_000;

/** Number of whole calendar days between now and a due date (negative = past). */
export function daysUntil(dueDate: string | null | undefined, now = new Date()): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  return Math.round((startOfDue - startOfToday) / MS_PER_DAY);
}

/** Human-friendly relative due label, e.g. "Due in 3 days", "2 days overdue". */
export function dueRelativeLabel(task: TaskRow, now = new Date()): string {
  if (!task.dueDate) return 'No due date';
  const days = daysUntil(task.dueDate, now);
  if (days === null) return 'No due date';
  if (!isOpen(task)) return formatDate(task.dueDate);
  if (days < 0) {
    const n = Math.abs(days);
    return `${n} ${n === 1 ? 'day' : 'days'} overdue`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 14) return `Due in ${days} days`;
  return `Due ${formatDate(task.dueDate)}`;
}

export function dueUrgencyTone(task: TaskRow, now = new Date()): 'danger' | 'warning' | 'muted' {
  if (!task.dueDate || !isOpen(task)) return 'muted';
  const days = daysUntil(task.dueDate, now);
  if (days === null) return 'muted';
  if (days < 0) return 'danger';
  if (days <= 2) return 'warning';
  return 'muted';
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function participantName(task: TaskRow): string {
  const emp = taskEmployee(task);
  return emp ? `${emp.firstName} ${emp.lastName}`.trim() : '';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const AVATAR_PALETTE = [
  { bg: 'rgba(255, 84, 54, 0.14)', fg: '#c2410c' },
  { bg: 'rgba(59, 130, 246, 0.16)', fg: '#1d4ed8' },
  { bg: 'rgba(16, 185, 129, 0.16)', fg: '#047857' },
  { bg: 'rgba(168, 85, 247, 0.16)', fg: '#7e22ce' },
  { bg: 'rgba(234, 179, 8, 0.18)', fg: '#a16207' },
  { bg: 'rgba(236, 72, 153, 0.16)', fg: '#be185d' },
];

export function avatarColor(seed: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]!;
}
