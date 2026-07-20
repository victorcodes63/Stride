'use client';

import { useMemo } from 'react';
import { Diamond, Flag } from 'lucide-react';
import type { MilestoneDTO, TaskDTO } from '@/types/projects';
import {
  buildTimelineRange,
  enumerateDays,
  layoutBar,
  toDateKey,
} from '@/app/dashboard/(app)/projects/_lib/timeline';
import { PRIORITY_DOT, isOverdue } from '@/app/dashboard/(app)/projects/_lib/constants';

const DAY_PX = 36;
const LABEL_W = 200;

export type ProjectTimelineProps = {
  projectStart?: string | null;
  projectDue?: string | null;
  milestones: MilestoneDTO[];
  tasks: TaskDTO[];
  onTaskClick: (taskId: string) => void;
  onMilestoneClick?: (milestoneId: string) => void;
};

type Row =
  | { kind: 'milestone'; milestone: MilestoneDTO }
  | { kind: 'task'; task: TaskDTO };

export function ProjectTimeline({
  projectStart,
  projectDue,
  milestones,
  tasks,
  onTaskClick,
  onMilestoneClick,
}: ProjectTimelineProps) {
  const topTasks = useMemo(() => tasks.filter((t) => !t.parentTaskId), [tasks]);

  const range = useMemo(() => {
    const dates = [
      projectStart,
      projectDue,
      ...milestones.map((m) => m.dueDate),
      ...topTasks.flatMap((t) => [t.startDate, t.dueDate]),
    ];
    return buildTimelineRange(dates, 4);
  }, [projectStart, projectDue, milestones, topTasks]);

  const days = useMemo(() => enumerateDays(range), [range]);
  const todayKey = toDateKey(new Date());
  const widthPx = days.length * DAY_PX;

  const rows = useMemo(() => {
    const out: Row[] = [];
    const byMs = new Map<string, TaskDTO[]>();
    const ungrouped: TaskDTO[] = [];
    for (const t of topTasks) {
      if (t.milestoneId) {
        const list = byMs.get(t.milestoneId) ?? [];
        list.push(t);
        byMs.set(t.milestoneId, list);
      } else {
        ungrouped.push(t);
      }
    }
    for (const m of milestones) {
      out.push({ kind: 'milestone', milestone: m });
      for (const t of byMs.get(m.id) ?? []) out.push({ kind: 'task', task: t });
    }
    for (const t of ungrouped) out.push({ kind: 'task', task: t });
    return out;
  }, [milestones, topTasks]);

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-6 py-16 text-center text-sm text-[var(--dash-text-muted)]">
        Add milestones or tasks with dates to see the timeline.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)]">
      <div className="overflow-x-auto">
        <div style={{ minWidth: LABEL_W + widthPx }} className="relative">
          {/* Header */}
          <div className="sticky top-0 z-20 flex border-b border-[var(--dash-border)] bg-[var(--dash-surface-muted)]">
            <div
              className="sticky left-0 z-30 flex shrink-0 items-center border-r border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]"
              style={{ width: LABEL_W }}
            >
              Item
            </div>
            <div className="relative flex" style={{ width: widthPx }}>
              {days.map((d, i) => {
                const date = new Date(`${d}T12:00:00`);
                const isToday = d === todayKey;
                const showLabel = i === 0 || date.getDate() === 1 || date.getDay() === 1;
                return (
                  <div
                    key={d}
                    className={`relative shrink-0 border-r border-[var(--dash-border-subtle)] text-center ${
                      isToday ? 'bg-[var(--stride-coral)]/10' : ''
                    }`}
                    style={{ width: DAY_PX }}
                  >
                    {showLabel ? (
                      <span className="block py-2 text-[10px] font-medium text-[var(--dash-text-muted)]">
                        {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    ) : (
                      <span className="block py-2 text-[10px] text-transparent">·</span>
                    )}
                  </div>
                );
              })}
              {days.includes(todayKey) ? (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 w-px bg-[var(--stride-coral)]"
                  style={{ left: days.indexOf(todayKey) * DAY_PX + DAY_PX / 2 }}
                />
              ) : null}
            </div>
          </div>

          {/* Rows */}
          {rows.map((row) => {
            if (row.kind === 'milestone') {
              const m = row.milestone;
              const bar = layoutBar(range, projectStart ?? m.dueDate, m.dueDate);
              const color = m.color || '#f97316';
              return (
                <div
                  key={`ms-${m.id}`}
                  className="flex border-b border-[var(--dash-border-subtle)] bg-[var(--dash-surface-muted)]/40"
                >
                  <button
                    type="button"
                    onClick={() => onMilestoneClick?.(m.id)}
                    className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-3 py-2 text-left hover:bg-[var(--dash-hover)]"
                    style={{ width: LABEL_W }}
                  >
                    <Flag className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                    <span className="truncate text-xs font-semibold text-[var(--dash-text-strong)]">
                      {m.title}
                    </span>
                  </button>
                  <div className="relative h-10" style={{ width: widthPx }}>
                    {days.map((d, i) => (
                      <div
                        key={d}
                        className={`absolute inset-y-0 border-r border-[var(--dash-border-subtle)] ${
                          d === todayKey ? 'bg-[var(--stride-coral)]/5' : ''
                        }`}
                        style={{ left: i * DAY_PX, width: DAY_PX }}
                      />
                    ))}
                    <div
                      className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center rounded-full px-2 text-[10px] font-semibold text-white shadow-sm"
                      style={{
                        left: `${bar.leftPct}%`,
                        width: `${bar.widthPct}%`,
                        minWidth: 24,
                        backgroundColor: color,
                        opacity: bar.undated ? 0.45 : 1,
                      }}
                      title={m.dueDate ? `Due ${m.dueDate}` : 'No due date'}
                    >
                      <Diamond className="mr-1 h-3 w-3 shrink-0" />
                      <span className="truncate">{m.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              );
            }

            const t = row.task;
            const bar = layoutBar(range, t.startDate, t.dueDate);
            const overdue = isOverdue(t.dueDate, t.status);
            const barColor =
              t.status === 'done'
                ? '#10b981'
                : overdue
                  ? '#ef4444'
                  : t.status === 'blocked'
                    ? '#f43f5e'
                    : '#6366f1';

            return (
              <div key={`task-${t.id}`} className="flex border-b border-[var(--dash-border-subtle)] last:border-0">
                <button
                  type="button"
                  onClick={() => onTaskClick(t.id)}
                  className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3 py-2 text-left hover:bg-[var(--dash-hover)]"
                  style={{ width: LABEL_W }}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[t.priority] ?? PRIORITY_DOT.medium}`}
                  />
                  <span className="truncate text-xs text-[var(--dash-text-body)]">{t.title}</span>
                </button>
                <div className="relative h-9" style={{ width: widthPx }}>
                  {days.map((d, i) => (
                    <div
                      key={d}
                      className={`absolute inset-y-0 border-r border-[var(--dash-border-subtle)] ${
                        d === todayKey ? 'bg-[var(--stride-coral)]/5' : ''
                      }`}
                      style={{ left: i * DAY_PX, width: DAY_PX }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => onTaskClick(t.id)}
                    className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md px-1.5 text-[10px] font-medium text-white shadow-sm hover:brightness-110"
                    style={{
                      left: `${bar.leftPct}%`,
                      width: `${bar.widthPct}%`,
                      minWidth: 18,
                      backgroundColor: barColor,
                      opacity: bar.undated ? 0.4 : t.status === 'done' ? 0.75 : 1,
                    }}
                    title={`${t.title}${t.dueDate ? ` · due ${t.dueDate}` : ''}`}
                  >
                    <span className="truncate">{t.title}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-[var(--dash-border)] px-3 py-2 text-[10px] text-[var(--dash-text-muted)]">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--stride-coral)]" /> Today
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded bg-indigo-500" /> Task
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded bg-emerald-500" /> Done
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded bg-red-500" /> Overdue / blocked
        </span>
        <span className="inline-flex items-center gap-1">
          <Flag className="h-3 w-3 text-orange-500" /> Milestone
        </span>
      </div>
    </div>
  );
}
