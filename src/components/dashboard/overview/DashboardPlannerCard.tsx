'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { APP_TIMEZONE } from '@/lib/timezone';
import { readIncludeCompanyPreference } from '@/lib/calendar-company-merge';

/** Same shape the existing calendar card reads from /api/calendar/personal-events. */
type AgendaEvent = {
  id: string;
  kind: string;
  title: string;
  status: string;
  startsAt?: string;
  startDate?: string;
  endDate?: string;
  allDay?: boolean;
  priority?: string;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const KIND_STYLE: Record<string, { dot: string; label: string }> = {
  task: { dot: 'bg-primary-500', label: 'Task' },
  leave: { dot: 'bg-amber-500', label: 'Leave' },
  company: { dot: 'bg-[var(--dash-text-strong)]', label: 'Company' },
  note: { dot: 'bg-sky-500', label: 'Note' },
};

function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

function mondayOf(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return shiftKey(key, -((dow + 6) % 7));
}

function monthGrid(year: number, month: number) {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const last = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const start = mondayOf(first);
  const end = shiftKey(mondayOf(last), 6);
  const keys: string[] = [];
  for (let cursor = start; cursor <= end; cursor = shiftKey(cursor, 1)) keys.push(cursor);
  return { keys, start, end };
}

function eventStart(event: AgendaEvent) {
  if (event.allDay && event.startDate) return event.startDate;
  return event.startsAt ? dayKey(new Date(event.startsAt)) : null;
}

function coversDay(event: AgendaEvent, key: string) {
  if (event.allDay && event.startDate && event.endDate) return key >= event.startDate && key <= event.endDate;
  return eventStart(event) === key;
}

function formatDayLabel(key: string, today: string) {
  if (key === today) return 'Today';
  if (key === shiftKey(today, 1)) return 'Tomorrow';
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y!, m! - 1, d!)),
  );
}

function timeLabel(event: AgendaEvent) {
  if (event.allDay || !event.startsAt) return 'All day';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: APP_TIMEZONE }).format(
    new Date(event.startsAt),
  );
}

export function DashboardPlannerCard() {
  const today = useMemo(() => dayKey(), []);
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y!, month: m! - 1 };
  });
  const [selected, setSelected] = useState(today);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(Date.UTC(cursor.year, cursor.month, 1)),
      ),
    [cursor],
  );

  // Load the visible month plus a week ahead, so "Coming up" works at month end.
  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      const end = grid.end > shiftKey(today, 7) ? grid.end : shiftKey(today, 7);
      try {
        const res = await fetch(
          `/api/calendar/personal-events?start=${grid.start}&end=${end}${readIncludeCompanyPreference() ? '&includeCompany=1' : ''}`,
          { credentials: 'include', signal },
        );
        if (!res.ok) throw new Error('calendar');
        const data = (await res.json()) as { events?: AgendaEvent[] };
        setEvents(Array.isArray(data.events) ? data.events : []);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setEvents([]);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [grid.start, grid.end, today],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const busyDays = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const key of grid.keys) {
      const kinds = new Set<string>();
      for (const event of events) if (coversDay(event, key)) kinds.add(event.kind);
      if (kinds.size) map.set(key, kinds);
    }
    return map;
  }, [events, grid.keys]);

  const selectedItems = useMemo(
    () => events.filter((event) => coversDay(event, selected) && event.status !== 'done'),
    [events, selected],
  );

  const comingUp = useMemo(() => {
    const items: { key: string; event: AgendaEvent }[] = [];
    for (let offset = 1; offset <= 7; offset += 1) {
      const key = shiftKey(today, offset);
      for (const event of events) {
        if (event.status === 'done') continue;
        if (eventStart(event) === key) items.push({ key, event });
      }
    }
    return items.slice(0, 5);
  }, [events, today]);

  const pendingTasks = events.filter((event) => event.kind === 'task' && event.status !== 'done').length;

  return (
    <aside className="overflow-hidden rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] shadow-[0_1px_2px_rgba(26,23,20,0.04),0_8px_24px_-16px_rgba(26,23,20,0.18)]">
      {/* Header */}
      <div className="flex items-center justify-between bg-[var(--dash-text-strong)] px-5 py-4 text-white dark:bg-[var(--dash-surface-muted)]">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-white">
            <CalendarDays className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-[14px] font-semibold leading-tight">Plan your day</p>
            <p className="text-[12px] text-white/60">
              {pendingTasks > 0 ? `${pendingTasks} open task${pendingTasks === 1 ? '' : 's'} this month` : 'Nothing overdue'}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/calendar"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Open calendar"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Month */}
      <div className="px-5 pb-4 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold text-[var(--dash-text-strong)]">{monthLabel}</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor(({ year, month }) => (month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--dash-text-muted)] hover:bg-[var(--dash-surface-muted)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const [y, m] = today.split('-').map(Number);
                setCursor({ year: y!, month: m! - 1 });
                setSelected(today);
              }}
              className="rounded-lg px-2 py-1 text-[12px] font-semibold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/40"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor(({ year, month }) => (month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--dash-text-muted)] hover:bg-[var(--dash-surface-muted)]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-medium text-[var(--dash-text-subtle)]">
          {WEEKDAYS.map((day, index) => (
            <span key={`${day}-${index}`} className="py-1">
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {grid.keys.map((key) => {
            const inMonth = Number(key.slice(5, 7)) - 1 === cursor.month;
            const isToday = key === today;
            const isSelected = key === selected;
            const kinds = busyDays.get(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-xl text-[13px] tabular-nums transition-colors ${
                  isToday
                    ? 'bg-primary-500 font-semibold text-white'
                    : isSelected
                      ? 'bg-primary-50 font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                      : inMonth
                        ? 'text-[var(--dash-text-strong)] hover:bg-[var(--dash-surface-muted)]'
                        : 'text-[var(--dash-text-faint)] hover:bg-[var(--dash-surface-muted)]'
                }`}
              >
                {Number(key.slice(8))}
                {kinds ? (
                  <span className="absolute bottom-1 flex gap-0.5">
                    {[...kinds].slice(0, 3).map((kind) => (
                      <span
                        key={kind}
                        className={`h-1 w-1 rounded-full ${isToday ? 'bg-white' : KIND_STYLE[kind]?.dot ?? 'bg-[var(--dash-text-subtle)]'}`}
                      />
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day */}
      <div className="border-t border-[var(--dash-border)] px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--dash-text-subtle)]">
            {formatDayLabel(selected, today)}
          </p>
          <Link
            href="/dashboard/calendar"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary-600 hover:text-primary-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Link>
        </div>
        {loading ? (
          <div className="mt-3 space-y-2">
            <div className="skeleton h-10 rounded-lg" />
            <div className="skeleton h-10 rounded-lg" />
          </div>
        ) : selectedItems.length === 0 ? (
          <p className="mt-2 text-[13px] text-[var(--dash-text-muted)]">Nothing scheduled. A clear day.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {selectedItems.slice(0, 4).map((event) => (
              <AgendaRow key={event.id} event={event} meta={timeLabel(event)} />
            ))}
          </ul>
        )}
      </div>

      {/* Coming up */}
      <div className="border-t border-[var(--dash-border)] bg-[var(--dash-surface-muted)]/50 px-5 py-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--dash-text-subtle)]">Coming up</p>
        {loading ? (
          <div className="skeleton mt-3 h-10 rounded-lg" />
        ) : comingUp.length === 0 ? (
          <p className="mt-2 text-[13px] text-[var(--dash-text-muted)]">Nothing due in the next 7 days.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {comingUp.map(({ key, event }) => (
              <AgendaRow key={`${key}-${event.id}`} event={event} meta={formatDayLabel(key, today)} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function AgendaRow({ event, meta }: { event: AgendaEvent; meta: string }) {
  const style = KIND_STYLE[event.kind] ?? { dot: 'bg-[var(--dash-text-subtle)]', label: 'Item' };
  const urgent = event.priority === 'urgent' || event.priority === 'high';
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--dash-surface-solid)]">
      <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-[var(--dash-text-strong)]">{event.title}</span>
        <span className="block text-[12px] text-[var(--dash-text-subtle)]">
          {style.label} · {meta}
        </span>
      </span>
      {urgent ? (
        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
          {event.priority === 'urgent' ? 'Urgent' : 'High'}
        </span>
      ) : null}
    </li>
  );
}
