'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Loader2 } from 'lucide-react';
import { APP_TIMEZONE, formatInNairobi } from '@/lib/timezone';
import {
  staffTaskPriorityLabel,
  staffTaskPriorityRank,
  staffTaskPriorityTone,
} from '@/lib/staff-task-api';
import { readIncludeCompanyPreference } from '@/lib/calendar-company-merge';

type AgendaEvent = {
  id: string;
  sourceId?: string;
  kind: string;
  title: string;
  status: string;
  startsAt?: string;
  startDate?: string;
  endDate?: string;
  allDay?: boolean;
  priority?: string;
};

function nairobiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDaysKey(key: string, amount: number) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + amount));
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function eventDayKey(event: AgendaEvent) {
  if (event.allDay && event.startDate) return event.startDate;
  if (event.startsAt) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(event.startsAt));
  }
  return null;
}

function eventSortKey(event: AgendaEvent) {
  return event.startsAt ?? (event.startDate ? `${event.startDate}T00:00:00+03:00` : '');
}

function kindLabel(kind: string) {
  if (kind === 'focus') return 'Focus';
  if (kind === 'break') return 'Break';
  if (kind === 'shared') return 'Shared';
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function deepLink(event: AgendaEvent): string | null {
  if (!event.sourceId) return null;
  if (event.kind === 'interview') return `/dashboard/interviews?interview=${encodeURIComponent(event.sourceId)}`;
  if (event.kind === 'leave') return `/dashboard/leave?application=${encodeURIComponent(event.sourceId)}`;
  if (event.kind === 'task') return `/dashboard/my-tasks?task=${encodeURIComponent(event.sourceId)}`;
  return null;
}

function sortDayEvents(items: AgendaEvent[]) {
  return [...items].sort((a, b) => {
    const priorityDelta = staffTaskPriorityRank(b.priority) - staffTaskPriorityRank(a.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return eventSortKey(a).localeCompare(eventSortKey(b));
  });
}

export type CalendarAgendaEvent = AgendaEvent;

type Props = {
  className?: string;
  title?: string;
  /** When true, event rows link into calendar with ?event= */
  calendarHref?: boolean;
  maxItems?: number;
  /** Drop outer chrome when nested inside My Day card shell. */
  embedded?: boolean;
  /** Fill the parent card height before showing “and X more”. */
  fillToHeight?: boolean;
  /**
   * list — flat preview (My Day).
   * day-picker — Today focus + next-day pills (calendar aside).
   */
  mode?: 'list' | 'day-picker';
  /** When set, row clicks call this instead of navigating. */
  onSelectEvent?: (event: AgendaEvent) => void;
  /** Hide the “Open calendar” header link (useful on the calendar page itself). */
  hideCalendarLink?: boolean;
  /** Notify parent when the selected day pill changes (day-picker mode). */
  onSelectedDayChange?: (dateKey: string) => void;
};

export default function CalendarAgendaStrip({
  className = '',
  title = 'Next 7 days',
  calendarHref = true,
  maxItems = 12,
  embedded = false,
  fillToHeight = false,
  mode = 'list',
  onSelectEvent,
  hideCalendarLink = false,
  onSelectedDayChange,
}: Props) {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previewLimit = maxItems;
  const todayKey = nairobiDateKey();
  const dayKeys = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDaysKey(todayKey, index)),
    [todayKey],
  );
  const [selectedDay, setSelectedDay] = useState(todayKey);

  useEffect(() => {
    const start = todayKey;
    const end = addDaysKey(start, 6);
    const controller = new AbortController();
    const includeCompany = readIncludeCompanyPreference();
    setLoading(true);
    fetch(
      `/api/calendar/personal-events?start=${start}&end=${end}${includeCompany ? '&includeCompany=1' : ''}`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load agenda');
        const rows = Array.isArray(data.events) ? (data.events as AgendaEvent[]) : [];
        setEvents(rows);
        setError(null);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return;
        setEvents([]);
        setError(e instanceof Error ? e.message : 'Failed to load agenda');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [todayKey]);

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const key of dayKeys) map.set(key, 0);
    for (const event of events) {
      const day = eventDayKey(event);
      if (!day || !map.has(day)) continue;
      map.set(day, (map.get(day) ?? 0) + 1);
    }
    return map;
  }, [dayKeys, events]);

  const selectedEvents = useMemo(() => {
    const day = mode === 'day-picker' ? selectedDay : todayKey;
    const forDay = events.filter((event) => eventDayKey(event) === day);
    if (mode === 'day-picker') return sortDayEvents(forDay);
    // Compact list mode: today first across the window, then chronological.
    const sorted = [...events].sort((a, b) => {
      const aDay = eventDayKey(a) ?? '';
      const bDay = eventDayKey(b) ?? '';
      if (aDay !== bDay) {
        if (aDay === todayKey) return -1;
        if (bDay === todayKey) return 1;
        return aDay.localeCompare(bDay);
      }
      const priorityDelta = staffTaskPriorityRank(b.priority) - staffTaskPriorityRank(a.priority);
      if (priorityDelta !== 0) return priorityDelta;
      return eventSortKey(a).localeCompare(eventSortKey(b));
    });
    return sorted;
  }, [events, mode, selectedDay, todayKey]);

  const visible = selectedEvents.slice(0, previewLimit);
  const remaining = Math.max(0, selectedEvents.length - visible.length);

  const selectDay = (key: string) => {
    setSelectedDay(key);
    onSelectedDayChange?.(key);
  };

  const renderRow = (event: AgendaEvent, opts?: { showDay?: boolean }) => {
    const day = eventDayKey(event);
    const isToday = day === todayKey;
    const href = onSelectEvent
      ? null
      : deepLink(event) ??
        (calendarHref && event.sourceId
          ? `/dashboard/calendar?scope=${event.kind === 'company' ? 'company' : 'personal'}&event=${encodeURIComponent(event.sourceId)}`
          : calendarHref
            ? '/dashboard/calendar?scope=personal'
            : null);
    const timeLabel = event.allDay
      ? 'All day'
      : event.startsAt
        ? formatInNairobi(new Date(event.startsAt), {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        : '';
    const dayLabel = day
      ? formatInNairobi(new Date(`${day}T12:00:00+03:00`), {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      : '';
    const priorityLabel = staffTaskPriorityLabel(event.priority);
    const rowClass = `flex w-full items-center gap-2 rounded-lg px-1.5 py-2 text-left transition-colors ${
      isToday && mode === 'list'
        ? 'border-l-[3px] border-l-secondary-500 bg-primary-50/40 hover:bg-primary-50/60'
        : 'hover:bg-neutral-100'
    }`;
    const content = (
      <>
        {opts?.showDay ? (
          <span
            className={`w-16 shrink-0 text-xs font-semibold tabular-nums sm:w-20 ${
              isToday ? 'text-primary-800' : 'text-neutral-500'
            }`}
          >
            {isToday ? 'Today' : dayLabel}
          </span>
        ) : null}
        <span className="w-12 shrink-0 text-xs tabular-nums text-neutral-600 sm:w-14">{timeLabel}</span>
        <span
          className={`min-w-0 flex-1 text-sm font-medium text-neutral-900 ${
            mode === 'day-picker' ? 'line-clamp-2' : 'truncate'
          }`}
        >
          {event.title}
        </span>
        {priorityLabel ? (
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${staffTaskPriorityTone(
              event.priority,
            )}`}
          >
            {priorityLabel}
          </span>
        ) : null}
        {!embedded || mode === 'day-picker' ? (
          <span className="hidden shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 sm:inline">
            {kindLabel(event.kind)}
          </span>
        ) : null}
      </>
    );

    if (onSelectEvent) {
      return (
        <button type="button" onClick={() => onSelectEvent(event)} className={rowClass}>
          {content}
        </button>
      );
    }
    if (href) {
      return (
        <Link href={href} className={rowClass}>
          {content}
        </Link>
      );
    }
    return <div className={rowClass}>{content}</div>;
  };

  const body = (
    <>
      {mode === 'day-picker' ? (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5">
          {dayKeys.map((key) => {
            const count = countsByDay.get(key) ?? 0;
            const selected = key === selectedDay;
            const isToday = key === todayKey;
            const label = isToday
              ? 'Today'
              : formatInNairobi(new Date(`${key}T12:00:00+03:00`), {
                  weekday: 'short',
                  day: 'numeric',
                });
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectDay(key)}
                aria-pressed={selected}
                className={`inline-flex shrink-0 flex-col items-center rounded-xl border px-2.5 py-1.5 text-center transition-colors ${
                  selected
                    ? 'border-primary-300 bg-primary-50 text-primary-950'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
                <span
                  className={`mt-0.5 text-xs font-semibold tabular-nums ${
                    count > 0 ? 'text-primary-800' : 'text-neutral-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading agenda…
        </p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {mode === 'day-picker'
            ? selectedDay === todayKey
              ? 'Nothing scheduled for today.'
              : 'Nothing scheduled for this day.'
            : 'Nothing in the next 7 days.'}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-neutral-100">
            {visible.map((event) => (
              <li key={event.id}>{renderRow(event, { showDay: mode === 'list' })}</li>
            ))}
          </ul>
          {remaining > 0 && mode === 'list' ? (
            <Link
              href="/dashboard/calendar?scope=personal"
              className="mt-1 inline-flex text-xs font-semibold text-primary-800 hover:underline"
            >
              and {remaining} more
            </Link>
          ) : null}
          {remaining > 0 && mode === 'day-picker' ? (
            <p className="mt-2 text-xs font-medium text-neutral-500">+{remaining} more this day</p>
          ) : null}
        </>
      )}
    </>
  );

  if (embedded) {
    return (
      <div
        className={
          fillToHeight
            ? `flex min-h-0 flex-1 flex-col ${className}`.trim()
            : className.trim() || undefined
        }
      >
        {body}
      </div>
    );
  }

  return (
    <section
      className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary-800" aria-hidden />
            <h2 className="text-sm font-bold text-primary-950">{title}</h2>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">
            {mode === 'day-picker'
              ? 'Pick a day · priority then time'
              : 'Today first · sorted by priority'}
          </p>
        </div>
        {!hideCalendarLink ? (
          <Link
            href="/dashboard/calendar?scope=personal"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-950"
          >
            Open calendar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      <div className="px-4 py-3">{body}</div>
    </section>
  );
}
