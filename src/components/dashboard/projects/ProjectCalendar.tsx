'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import type { MilestoneDTO, TaskDTO } from '@/types/projects';
import { monthMatrix, toDateKey } from '@/app/dashboard/(app)/projects/_lib/timeline';
import { PRIORITY_DOT, isOverdue } from '@/app/dashboard/(app)/projects/_lib/constants';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type ProjectCalendarProps = {
  tasks: TaskDTO[];
  milestones: MilestoneDTO[];
  onTaskClick: (taskId: string) => void;
};

type DayItem =
  | { kind: 'task'; task: TaskDTO }
  | { kind: 'milestone'; milestone: MilestoneDTO };

export function ProjectCalendar({ tasks, milestones, onTaskClick }: ProjectCalendarProps) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);
  const todayKey = toDateKey(today);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const push = (key: string | null | undefined, item: DayItem) => {
      if (!key) return;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    };
    for (const t of tasks.filter((x) => !x.parentTaskId)) {
      push(t.dueDate, { kind: 'task', task: t });
    }
    for (const m of milestones) {
      push(m.dueDate, { kind: 'milestone', milestone: m });
    }
    return map;
  }, [tasks, milestones]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)]">
      <div className="flex items-center justify-between border-b border-[var(--dash-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[var(--stride-coral)]" />
          <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">{monthLabel}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-[var(--dash-border)] bg-[var(--dash-surface-muted)]">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((dayKey, idx) => {
          if (!dayKey) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[6.5rem] border-b border-r border-[var(--dash-border-subtle)] bg-[var(--dash-surface-muted)]/30"
              />
            );
          }
          const dayNum = Number(dayKey.slice(8, 10));
          const isToday = dayKey === todayKey;
          const items = itemsByDay.get(dayKey) ?? [];
          return (
            <div
              key={dayKey}
              className={`min-h-[6.5rem] border-b border-r border-[var(--dash-border-subtle)] p-1.5 ${
                isToday ? 'bg-[var(--stride-coral)]/5' : ''
              }`}
            >
              <div
                className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isToday
                    ? 'bg-[var(--stride-coral)] text-white'
                    : 'text-[var(--dash-text-muted)]'
                }`}
              >
                {dayNum}
              </div>
              <ul className="space-y-0.5">
                {items.slice(0, 4).map((item) => {
                  if (item.kind === 'milestone') {
                    return (
                      <li
                        key={`m-${item.milestone.id}`}
                        className="truncate rounded px-1 py-0.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: item.milestone.color || '#f97316' }}
                        title={`Milestone: ${item.milestone.title}`}
                      >
                        ◆ {item.milestone.title}
                      </li>
                    );
                  }
                  const overdue = isOverdue(item.task.dueDate, item.task.status);
                  return (
                    <li key={`t-${item.task.id}`}>
                      <button
                        type="button"
                        onClick={() => onTaskClick(item.task.id)}
                        className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] hover:bg-[var(--dash-hover)] ${
                          overdue
                            ? 'font-medium text-red-600'
                            : item.task.status === 'done'
                              ? 'text-[var(--dash-text-muted)] line-through'
                              : 'text-[var(--dash-text-body)]'
                        }`}
                        title={item.task.title}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[item.task.priority]}`}
                        />
                        <span className="truncate">{item.task.title}</span>
                      </button>
                    </li>
                  );
                })}
                {items.length > 4 ? (
                  <li className="px-1 text-[10px] text-[var(--dash-text-muted)]">
                    +{items.length - 4} more
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
