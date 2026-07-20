import type {
  ProjectHealth,
  ProjectMilestoneStatus,
  ProjectStatus,
  ProjectTaskPriority,
  ProjectTaskStatus,
} from '@/types/projects';

export const TASK_COLUMNS = [
  { key: 'backlog' as const, label: 'Backlog' },
  { key: 'todo' as const, label: 'To do' },
  { key: 'in_progress' as const, label: 'In progress' },
  { key: 'blocked' as const, label: 'Blocked' },
  { key: 'done' as const, label: 'Done' },
];

export type TaskColumnKey = (typeof TASK_COLUMNS)[number]['key'];

export const TASK_STATUS_STYLES: Record<ProjectTaskStatus, string> = {
  backlog: 'bg-neutral-100 text-neutral-600',
  todo: 'bg-blue-50 text-blue-800',
  in_progress: 'bg-violet-50 text-violet-800',
  blocked: 'bg-red-50 text-red-800',
  done: 'bg-emerald-50 text-emerald-800',
};

export const PRIORITY_DOT: Record<ProjectTaskPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-neutral-300',
};

export const PRIORITY_LABEL: Record<ProjectTaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  planning: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-50 text-emerald-800',
  on_hold: 'bg-amber-50 text-amber-800',
  completed: 'bg-neutral-100 text-neutral-600',
  cancelled: 'bg-neutral-100 text-neutral-500',
};

export const HEALTH_STYLES: Record<ProjectHealth, string> = {
  on_track: 'bg-emerald-50 text-emerald-800',
  at_risk: 'bg-amber-50 text-amber-800',
  off_track: 'bg-red-50 text-red-800',
};

export const HEALTH_LABEL: Record<ProjectHealth, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track',
};

export const MILESTONE_STATUS_STYLES: Record<ProjectMilestoneStatus, string> = {
  pending: 'bg-neutral-100 text-neutral-600',
  in_progress: 'bg-violet-50 text-violet-800',
  done: 'bg-emerald-50 text-emerald-800',
};

export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function isOverdue(dueDate: string | null | undefined, status?: string): boolean {
  if (!dueDate || status === 'done') return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}
