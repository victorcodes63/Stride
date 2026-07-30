'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { APP_TIMEZONE, formatInNairobi } from '@/lib/timezone';
import { readIncludeCompanyPreference } from '@/lib/calendar-company-merge';
import {
  staffTaskPriorityLabel,
  staffTaskPriorityRank,
  staffTaskPriorityTone,
} from '@/lib/staff-task-api';

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

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

function mondayOfKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay(); // 0 Sun … 6 Sat
  const offset = (dow + 6) % 7; // Mon=0
  return addDaysKey(key, -offset);
}

function monthGridKeys(year: number, monthIndex: number) {
  const firstKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const lastKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const start = mondayOfKey(firstKey);
  const endMonday = mondayOfKey(lastKey);
  const end = addDaysKey(endMonday, 6);
  const keys: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDaysKey(cursor, 1)) {
    keys.push(cursor);
  }
  return { keys, start, end };
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

function eventCoversDay(event: AgendaEvent, day: string) {
  if (event.allDay && event.startDate && event.endDate) {
    return day >= event.startDate && day <= event.endDate;
  }
  return eventDayKey(event) === day;
}

function eventSortKey(event: AgendaEvent) {
  return event.startsAt ?? (event.startDate ? `${event.startDate}T00:00:00+03:00` : '');
}

function kindDotClass(kind: string) {
  if (kind === 'leave') return 'bg-sky-500';
  if (kind === 'task') return 'bg-violet-500';
  if (kind === 'reminder') return 'bg-rose-500';
  if (kind === 'focus') return 'bg-fuchsia-500';
  if (kind === 'company' || kind === 'company_note') return 'bg-orange-500';
  if (kind === 'note') return 'bg-amber-500';
  if (kind === 'shared') return 'bg-violet-400';
  return 'bg-[var(--stride-coral)]';
}

function deepLink(event: AgendaEvent): string {
  if (event.sourceId) {
    if (event.kind === 'leave') {
      return `/dashboard/staff-leave?tab=my&application=${encodeURIComponent(event.sourceId)}`;
    }
    if (event.kind === 'task') {
      return `/dashboard/my-tasks?task=${encodeURIComponent(event.sourceId)}`;
    }
    return `/dashboard/calendar?scope=${
      event.kind === 'company' || event.kind === 'company_note' ? 'company' : 'personal'
    }&event=${encodeURIComponent(event.sourceId)}`;
  }
  return '/dashboard/calendar?scope=personal';
}

export function MyCalendarCompactCard() {
  const todayKey = nairobiDateKey();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayKey.split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const grid = useMemo(
    () => monthGridKeys(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-KE', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(Date.UTC(cursor.year, cursor.month, 1))),
    [cursor.year, cursor.month],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      const includeCompany = readIncludeCompanyPreference();
      try {
        const res = await fetch(
          `/api/calendar/personal-events?start=${grid.start}&end=${grid.end}${
            includeCompany ? '&includeCompany=1' : ''
          }`,
          { credentials: 'include', signal },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || 'Failed to load calendar');
        }
        const data = (await res.json()) as { events?: AgendaEvent[] };
        setEvents(Array.isArray(data.events) ? data.events : []);
        setError(null);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
        setEvents([]);
        setError(e instanceof Error ? e.message : 'Failed to load calendar');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [grid.start, grid.end],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Keep selected day inside the visible month when navigating months.
  useEffect(() => {
    const prefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
    if (!selectedDay.startsWith(prefix)) {
      if (todayKey.startsWith(prefix)) setSelectedDay(todayKey);
      else setSelectedDay(`${prefix}-01`);
    }
  }, [cursor.year, cursor.month, selectedDay, todayKey]);

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const key of grid.keys) map.set(key, 0);
    for (const event of events) {
      for (const key of grid.keys) {
        if (!eventCoversDay(event, key)) continue;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return map;
  }, [events, grid.keys]);

  const selectedEvents = useMemo(() => {
    return events
      .filter((event) => eventCoversDay(event, selectedDay))
      .sort((a, b) => {
        const priorityDelta = staffTaskPriorityRank(b.priority) - staffTaskPriorityRank(a.priority);
        if (priorityDelta !== 0) return priorityDelta;
        return eventSortKey(a).localeCompare(eventSortKey(b));
      });
  }, [events, selectedDay]);

  const shiftMonth = (delta: number) => {
    setCursor((prev) => {
      const date = new Date(Date.UTC(prev.year, prev.month + delta, 1));
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
    });
  };

  const goToday = () => {
    const [y, m] = todayKey.split('-').map(Number);
    setCursor({ year: y, month: m - 1 });
    setSelectedDay(todayKey);
  };

  const selectedLabel =
    selectedDay === todayKey
      ? 'Today'
      : formatInNairobi(new Date(`${selectedDay}T12:00:00+03:00`), {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-solid)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--dash-border-subtle)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="dash-icon-well flex h-8 w-8 items-center justify-center rounded-lg">
              <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">My calendar</h3>
              <p className="text-[11px] text-[var(--dash-text-muted)]">{monthLabel}</p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Link
            href={`/dashboard/calendar?scope=personal&view=month&date=${encodeURIComponent(selectedDay)}`}
            className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-800 dark:text-primary-400"
          >
            Open <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="border-b border-[var(--dash-border-subtle)] px-3 py-2 sm:px-4">
        <div className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--dash-text-subtle)]"
            >
              {d}
            </div>
          ))}
          {grid.keys.map((key) => {
            const dayNum = Number(key.slice(8, 10));
            const inMonth = key.startsWith(
              `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`,
            );
            const isToday = key === todayKey;
            const isSelected = key === selectedDay;
            const count = countsByDay.get(key) ?? 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(key)}
                aria-pressed={isSelected}
                className={`relative flex min-h-[2.25rem] flex-col items-center justify-start rounded-lg px-0.5 py-1 transition ${
                  isSelected
                    ? 'bg-[rgba(var(--stride-coral-rgb),0.12)] ring-1 ring-[rgba(var(--stride-coral-rgb),0.35)]'
                    : 'hover:bg-[var(--dash-hover)]'
                } ${inMonth ? '' : 'opacity-40'}`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium tabular-nums ${
                    isToday
                      ? 'bg-[var(--stride-coral)] text-white'
                      : isSelected
                        ? 'text-[var(--dash-text-strong)]'
                        : 'text-[var(--dash-text-muted)]'
                  }`}
                >
                  {dayNum}
                </span>
                {count > 0 ? (
                  <span className="mt-0.5 flex items-center gap-0.5">
                    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <span
                        key={i}
                        className="h-1 w-1 rounded-full bg-[var(--stride-coral)]"
                        aria-hidden
                      />
                    ))}
                  </span>
                ) : (
                  <span className="mt-0.5 h-1" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 py-2 sm:px-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--dash-text-subtle)]">
            {selectedLabel}
          </p>
          <p className="text-[11px] tabular-nums text-[var(--dash-text-muted)]">
            {loading ? '…' : `${selectedEvents.length} item${selectedEvents.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-6 text-sm text-[var(--dash-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs font-medium text-primary-700 hover:underline dark:text-primary-400"
            >
              Retry
            </button>
          </div>
        ) : selectedEvents.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-[var(--dash-text-muted)]">Nothing scheduled.</p>
            <Link
              href={`/dashboard/calendar?scope=personal&view=day&date=${encodeURIComponent(selectedDay)}`}
              className="mt-2 text-xs font-medium text-primary-700 hover:underline dark:text-primary-400"
            >
              Add something →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--dash-border-subtle)]">
            {selectedEvents.slice(0, 4).map((event) => {
              const timeLabel = event.allDay
                ? 'All day'
                : event.startsAt
                  ? formatInNairobi(new Date(event.startsAt), {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })
                  : '';
              const priorityLabel = staffTaskPriorityLabel(event.priority);
              return (
                <li key={event.id}>
                  <Link
                    href={deepLink(event)}
                    className="flex items-center gap-2 rounded-lg px-1 py-2 transition hover:bg-[var(--dash-hover)]"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${kindDotClass(event.kind)}`}
                      aria-hidden
                    />
                    <span className="w-12 shrink-0 text-[11px] tabular-nums text-[var(--dash-text-muted)]">
                      {timeLabel}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--dash-text-strong)]">
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
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {!loading && selectedEvents.length > 4 ? (
          <Link
            href={`/dashboard/calendar?scope=personal&view=day&date=${encodeURIComponent(selectedDay)}`}
            className="mt-1 text-[11px] font-medium text-[var(--dash-text-muted)] hover:text-primary-700 dark:hover:text-primary-400"
          >
            +{selectedEvents.length - 4} more this day
          </Link>
        ) : null}
      </div>
    </div>
  );
}
