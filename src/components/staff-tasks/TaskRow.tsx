'use client';

import Link from 'next/link';
import { Calendar, Check, Circle, Loader2, Pencil, Trash2 } from 'lucide-react';
import type { Scope, StaffTask } from './types';
import {
  PRIORITY_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  formatDue,
  getInitials,
  isDueToday,
  isOverdue,
  toDateInputValue,
} from './task-utils';

type Props = {
  task: StaffTask;
  scope: Scope;
  currentUserId: string | null;
  isAdmin: boolean;
  busy: boolean;
  highlighted?: boolean;
  variant?: 'card' | 'row';
  onToggleComplete: (task: StaffTask) => void;
  onEdit: (task: StaffTask) => void;
  onDelete: (id: string) => void;
};

function priorityDotClass(priority: StaffTask['priority']) {
  if (priority === 'high') return 'bg-red-500';
  if (priority === 'medium') return 'bg-amber-500';
  if (priority === 'low') return 'bg-neutral-400';
  return null;
}

export function TaskRow({
  task,
  scope,
  currentUserId,
  isAdmin,
  busy,
  highlighted = false,
  variant = 'card',
  onToggleComplete,
  onEdit,
  onDelete,
}: Props) {
  const done = task.status === 'done';
  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);
  const canDelete = task.createdById === currentUserId || isAdmin;
  const isRow = variant === 'row';
  const showStatus = task.status === 'in_progress' || task.status === 'done';
  const showAssignee = !task.assignee || scope !== 'assigned_to_me';
  const priorityDot = priorityDotClass(task.priority);
  const calendarHref =
    task.dueAt
      ? `/dashboard/calendar?scope=personal&date=${encodeURIComponent(toDateInputValue(task.dueAt))}&task=${encodeURIComponent(task.id)}`
      : null;

  let accentBar = 'bg-transparent';
  let accentBorder = 'border-l-transparent';
  if (overdue && !done) {
    accentBar = 'bg-red-500';
    accentBorder = 'border-l-red-500';
  } else if (dueToday && !done) {
    accentBar = 'bg-secondary-500';
    accentBorder = 'border-l-secondary-500';
  } else if (task.status === 'in_progress') {
    accentBar = 'bg-primary-500';
    accentBorder = 'border-l-primary-500';
  } else if (task.priority === 'high' && !done) {
    accentBar = 'bg-red-400';
    accentBorder = 'border-l-red-400';
  }

  const shell = isRow
    ? `group relative border-b border-neutral-100 last:border-b-0 transition-colors duration-150 ${
        highlighted ? 'bg-primary-50' : 'hover:bg-neutral-50'
      } ${done ? 'opacity-75' : ''}`
    : `group relative overflow-hidden rounded-2xl border border-l-4 bg-white shadow-sm transition-all duration-200 hover:shadow-md ${accentBorder} ${
        overdue && !done ? 'border-red-200' : 'border-neutral-200'
      } ${done ? 'opacity-90' : ''} ${highlighted ? 'ring-2 ring-primary-400/50 ring-offset-2' : ''}`;

  const actionsClass = `flex shrink-0 items-center gap-0.5 transition-opacity duration-150 ${
    isRow
      ? 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
      : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
  }`;

  return (
    <li id={`task-${task.id}`} className={shell}>
      {isRow ? (
        <span className={`absolute inset-y-1.5 left-0 w-0.5 rounded-full ${accentBar}`} aria-hidden />
      ) : null}

      <div
        className={`flex items-center gap-2.5 ${
          isRow ? 'px-4 py-2 sm:px-5' : 'items-start gap-3 px-4 py-3.5'
        }`}
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggleComplete(task)}
          className={`shrink-0 rounded-full p-0.5 transition-all duration-150 disabled:opacity-40 ${
            isRow ? '' : 'mt-0.5'
          } ${
            done
              ? 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
              : 'text-neutral-300 hover:bg-primary-50 hover:text-primary-600'
          }`}
          aria-label={done ? 'Mark incomplete' : 'Mark complete'}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
          ) : done ? (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 ring-1 ring-emerald-200/80">
              <Check className="h-3 w-3 text-emerald-700" strokeWidth={2.75} />
            </span>
          ) : (
            <Circle className="h-5 w-5 transition-transform group-hover:scale-105" strokeWidth={1.75} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="w-full rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
          >
            <div className={`flex min-w-0 items-center gap-2 ${isRow ? '' : 'flex-wrap gap-y-1'}`}>
              {priorityDot ? (
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${priorityDot}`}
                  title={`Priority: ${PRIORITY_LABEL[task.priority]}`}
                  aria-label={`Priority: ${PRIORITY_LABEL[task.priority]}`}
                />
              ) : null}
              <p
                className={`min-w-0 truncate text-sm font-semibold leading-snug tracking-tight ${
                  done ? 'font-medium text-neutral-500 line-through' : 'text-primary-950'
                }`}
              >
                {task.title}
              </p>
              {showStatus ? (
                <span
                  className={`inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_CLASS[task.status]}`}
                >
                  {STATUS_LABEL[task.status]}
                </span>
              ) : null}
            </div>

            {!isRow && task.description ? (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-500">
                {task.description}
              </p>
            ) : null}
          </button>

          {!isRow ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-neutral-500">
              {showAssignee ? (
                task.assignee ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-800">
                      {getInitials(task.assignee.name)}
                    </span>
                    <span className="max-w-[10rem] truncate sm:max-w-none">{task.assignee.name}</span>
                  </span>
                ) : (
                  <span className="font-medium text-amber-800">Unassigned</span>
                )
              ) : null}
              {task.dueAt ? (
                <span
                  className={`inline-flex items-center gap-1 ${
                    overdue
                      ? 'font-semibold text-red-700'
                      : dueToday
                        ? 'font-medium text-secondary-800'
                        : ''
                  }`}
                >
                  <Calendar className="h-3 w-3 shrink-0 opacity-70" />
                  {formatDue(task.dueAt)}
                  {overdue && !done ? (
                    <span className="rounded bg-red-100 px-1 py-px text-[10px] font-bold uppercase tracking-wide text-red-800">
                      Overdue
                    </span>
                  ) : dueToday && !done ? (
                    <span className="rounded bg-secondary-100 px-1 py-px text-[10px] font-bold uppercase tracking-wide text-secondary-900">
                      Today
                    </span>
                  ) : null}
                </span>
              ) : null}
              {scope !== 'assigned_to_me' && task.createdBy ? (
                <span className="text-neutral-400">by {task.createdBy.name}</span>
              ) : null}
            </div>
          ) : showAssignee || (scope !== 'assigned_to_me' && task.createdBy) ? (
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
              {showAssignee ? (
                task.assignee ? (
                  <span className="inline-flex max-w-[9rem] items-center gap-1 truncate sm:max-w-[12rem]">
                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[9px] font-bold text-primary-800">
                      {getInitials(task.assignee.name)}
                    </span>
                    <span className="truncate">{task.assignee.name}</span>
                  </span>
                ) : (
                  <span className="font-medium text-amber-800">Unassigned</span>
                )
              ) : null}
              {scope !== 'assigned_to_me' && task.createdBy ? (
                <span className="truncate text-neutral-400">by {task.createdBy.name}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {isRow && task.dueAt ? (
          <span
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs ${
              overdue && !done
                ? 'font-semibold text-red-700'
                : dueToday && !done
                  ? 'font-medium text-secondary-800'
                  : 'text-neutral-500'
            }`}
          >
            {formatDue(task.dueAt)}
            {overdue && !done ? (
              <span className="rounded bg-red-100 px-1 py-px text-[10px] font-bold uppercase tracking-wide text-red-800">
                Overdue
              </span>
            ) : dueToday && !done ? (
              <span className="rounded bg-secondary-100 px-1 py-px text-[10px] font-bold uppercase tracking-wide text-secondary-900">
                Today
              </span>
            ) : null}
          </span>
        ) : null}

        <div className={actionsClass}>
          {calendarHref ? (
            <Link
              href={calendarHref}
              className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-primary-50 hover:text-primary-800"
              title="Open due date on your personal calendar"
              aria-label="Open on calendar"
            >
              <Calendar className="h-3.5 w-3.5" />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-primary-50 hover:text-primary-800"
            aria-label="Edit task"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {canDelete ? (
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
              aria-label="Delete task"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
