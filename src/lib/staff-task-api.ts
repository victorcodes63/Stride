import type { StaffTaskPriority, StaffTaskStatus } from '@prisma/client';

export const STAFF_TASK_STATUSES: StaffTaskStatus[] = ['todo', 'in_progress', 'done'];
export const STAFF_TASK_PRIORITIES: StaffTaskPriority[] = ['none', 'low', 'medium', 'high'];

export const staffTaskInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
} as const;

export function parseStaffTaskStatus(raw: unknown): StaffTaskStatus | null {
  const s = String(raw || '').trim();
  return STAFF_TASK_STATUSES.includes(s as StaffTaskStatus) ? (s as StaffTaskStatus) : null;
}

export function parseStaffTaskPriority(raw: unknown): StaffTaskPriority | null {
  const p = String(raw || '').trim();
  return STAFF_TASK_PRIORITIES.includes(p as StaffTaskPriority) ? (p as StaffTaskPriority) : null;
}

/** Higher = more urgent (for sorting Due today / agenda). */
export function staffTaskPriorityRank(priority: string | null | undefined): number {
  switch (priority) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

export function staffTaskPriorityLabel(priority: string | null | undefined): string | null {
  switch (priority) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    default:
      return null;
  }
}

/** Compact badge classes for priority chips (light + dark remaps). */
export function staffTaskPriorityTone(priority: string | null | undefined): string {
  switch (priority) {
    case 'high':
      return 'bg-rose-50 text-rose-900 ring-rose-200';
    case 'medium':
      return 'bg-amber-50 text-amber-950 ring-amber-200';
    case 'low':
      return 'bg-sky-50 text-sky-950 ring-sky-200';
    default:
      return 'bg-neutral-100 text-neutral-600 ring-neutral-200';
  }
}

export function parseDueAt(raw: unknown): Date | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function statusSetsCompletedAt(
  status: StaffTaskStatus,
  previous: StaffTaskStatus,
): { completedAt: Date | null } | Record<string, never> {
  if (status === 'done' && previous !== 'done') return { completedAt: new Date() };
  if (status !== 'done' && previous === 'done') return { completedAt: null };
  return {};
}
