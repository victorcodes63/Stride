import type { ApplicationStatus } from '@/types/dashboard';

/** Canonical left-to-right pipeline order used by the board and the status changer. */
export const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [
  'pending',
  'reviewed',
  'shortlisted',
  'rejected',
  'hired',
];

export type ApplicationStatusMeta = {
  label: string;
  /** Subtle badge (list/detail pills). */
  badge: string;
  /** Solid active state for the status changer buttons. */
  activeButton: string;
  /** Small status dot. */
  dot: string;
  /** Kanban column header accent border. */
  columnAccent: string;
  /** Kanban column header text. */
  columnText: string;
  /** 1-based number key used for keyboard shortcuts. */
  hotkey: string;
};

export const APPLICATION_STATUS_META: Record<ApplicationStatus, ApplicationStatusMeta> = {
  pending: {
    label: 'Pending',
    badge: 'bg-amber-50 text-amber-700',
    activeButton: 'bg-amber-500 text-white shadow-sm',
    dot: 'bg-amber-500',
    columnAccent: 'border-t-amber-400',
    columnText: 'text-amber-700',
    hotkey: '1',
  },
  reviewed: {
    label: 'Reviewed',
    badge: 'bg-blue-50 text-blue-700',
    activeButton: 'bg-blue-600 text-white shadow-sm',
    dot: 'bg-blue-500',
    columnAccent: 'border-t-blue-400',
    columnText: 'text-blue-700',
    hotkey: '2',
  },
  shortlisted: {
    label: 'Shortlisted',
    badge: 'bg-indigo-50 text-indigo-700',
    activeButton: 'bg-indigo-600 text-white shadow-sm',
    dot: 'bg-indigo-500',
    columnAccent: 'border-t-indigo-400',
    columnText: 'text-indigo-700',
    hotkey: '3',
  },
  rejected: {
    label: 'Rejected',
    badge: 'bg-red-50 text-red-700',
    activeButton: 'bg-red-600 text-white shadow-sm',
    dot: 'bg-red-500',
    columnAccent: 'border-t-red-400',
    columnText: 'text-red-700',
    hotkey: '4',
  },
  hired: {
    label: 'Hired',
    badge: 'bg-emerald-50 text-emerald-700',
    activeButton: 'bg-emerald-600 text-white shadow-sm',
    dot: 'bg-emerald-500',
    columnAccent: 'border-t-emerald-400',
    columnText: 'text-emerald-700',
    hotkey: '5',
  },
};

/** Status transitions that should prompt a confirmation before applying. */
export const DESTRUCTIVE_STATUSES: ApplicationStatus[] = ['rejected'];

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === 'string' && value in APPLICATION_STATUS_META;
}
