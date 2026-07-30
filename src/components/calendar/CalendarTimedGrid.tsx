'use client';

import { useMemo, useRef, useState } from 'react';
import { APP_TIMEZONE, formatInNairobi, parseDateTimeAsNairobi } from '@/lib/timezone';

export type TimedGridEvent = {
  id: string;
  sourceId?: string;
  kind: string;
  title: string;
  status: string;
  startsAt?: string;
  startDate?: string;
  endDate?: string;
  allDay?: boolean;
  durationMinutes?: number;
  type?: string;
  priority?: string;
};

const HOUR_START = 6;
const HOUR_END = 22;
const PX_PER_HOUR = 48;
/** Floor so short (e.g. 15m) events still fit one line of title text. */
const MIN_EVENT_HEIGHT_PX = 28;
const SNAP_MINUTES = 15;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const GRID_HEIGHT = (HOUR_END - HOUR_START) * PX_PER_HOUR;

function nairobiTimeParts(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { hour: hour === 24 ? 0 : hour, minute };
}

function minutesFromGridStart(iso: string) {
  const { hour, minute } = nairobiTimeParts(iso);
  return hour * 60 + minute - HOUR_START * 60;
}

function snapMinutes(raw: number) {
  return Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function minutesToTimeLabel(totalMinutes: number) {
  const clamped = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - SNAP_MINUTES, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${pad(h)}:${pad(m)}`;
}

function isDraggable(event: TimedGridEvent) {
  return (
    Boolean(event.sourceId) &&
    (event.kind === 'personal' || event.kind === 'focus') &&
    event.status !== 'cancelled' &&
    !event.allDay &&
    Boolean(event.startsAt)
  );
}

type LaidOut = {
  event: TimedGridEvent;
  top: number;
  height: number;
  col: number;
  colCount: number;
};

function layoutTimedEvents(events: TimedGridEvent[]): LaidOut[] {
  const timed = events
    .filter((e) => !e.allDay && e.startsAt)
    .map((event) => {
      const startMin = minutesFromGridStart(event.startsAt!);
      const duration = Math.max(event.durationMinutes ?? 60, 15);
      const top = (startMin / 60) * PX_PER_HOUR;
      const height = Math.max((duration / 60) * PX_PER_HOUR, MIN_EVENT_HEIGHT_PX);
      return { event, startMin, endMin: startMin + duration, top, height };
    })
    .filter((row) => row.endMin > 0 && row.startMin < (HOUR_END - HOUR_START) * 60)
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const clusterCols: number[] = [];
  const result: LaidOut[] = [];

  for (const row of timed) {
    let col = 0;
    while (clusterCols[col] != null && clusterCols[col] > row.startMin) col += 1;
    clusterCols[col] = row.endMin;
    result.push({
      event: row.event,
      top: Math.max(0, row.top),
      height: Math.min(row.height, GRID_HEIGHT - Math.max(0, row.top)),
      col,
      colCount: 1,
    });
  }

  // Second pass: colCount = max concurrent in overlapping set
  for (let i = 0; i < result.length; i++) {
    let maxCol = result[i].col;
    for (let j = 0; j < result.length; j++) {
      if (i === j) continue;
      const a = timed[i];
      const b = timed[j];
      if (a.startMin < b.endMin && b.startMin < a.endMin) {
        maxCol = Math.max(maxCol, result[j].col);
      }
    }
    result[i].colCount = maxCol + 1;
  }

  return result;
}

function eventTone(event: TimedGridEvent) {
  if (event.kind === 'leave') return 'border-sky-200 bg-sky-50 text-sky-900';
  if (event.kind === 'note') return 'border-amber-200 bg-amber-50 text-amber-950';
  if (event.kind === 'reminder') return 'border-rose-200 bg-rose-50 text-rose-950';
  if (event.kind === 'task') {
    return event.status === 'done'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : event.priority === 'high'
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : 'border-violet-200 bg-violet-50 text-violet-900';
  }
  if (event.kind === 'interview') return 'border-indigo-200 bg-indigo-50 text-indigo-950';
  if (event.kind === 'break') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (event.kind === 'focus') return 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900';
  if (event.kind === 'personal') return 'border-cyan-200 bg-cyan-50 text-cyan-900';
  if (event.kind === 'company') return 'border-orange-200 bg-orange-50 text-orange-900';
  if (event.kind === 'shared') return 'border-violet-200 bg-violet-50 text-violet-950';
  if (event.kind === 'birthday') return 'border-pink-200 bg-pink-50 text-pink-900';
  return 'border-neutral-200 bg-neutral-100 text-neutral-800';
}

type Props = {
  days: Date[];
  todayKey: string;
  toDateKey: (date: Date) => string;
  eventsByDate: Map<string, TimedGridEvent[]>;
  selectedId?: string | null;
  onSelect: (event: TimedGridEvent) => void;
  onSlotClick: (day: Date, hour: number, minute: number) => void;
  onReschedule?: (
    event: TimedGridEvent,
    nextStartsAtIso: string,
    nextEndsAtIso: string,
  ) => Promise<void>;
  singleDay?: boolean;
};

export default function CalendarTimedGrid({
  days,
  todayKey,
  toDateKey,
  eventsByDate,
  selectedId,
  onSelect,
  onSlotClick,
  onReschedule,
  singleDay = false,
}: Props) {
  const [dragError, setDragError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const dragRef = useRef<{
    event: TimedGridEvent;
    dayKey: string;
    startY: number;
    originTop: number;
  } | null>(null);

  const columns = useMemo(
    () =>
      days.map((day) => {
        const key = toDateKey(day);
        const dayEvents = eventsByDate.get(key) ?? [];
        const allDay = dayEvents.filter((e) => e.allDay);
        const laidOut = layoutTimedEvents(dayEvents);
        return { day, key, allDay, laidOut };
      }),
    [days, eventsByDate, toDateKey],
  );

  const onLaneClick = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-cal-timed-event]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawMinutes = HOUR_START * 60 + (y / PX_PER_HOUR) * 60;
    const snapped = snapMinutes(rawMinutes);
    const hour = Math.floor(snapped / 60);
    const minute = snapped % 60;
    if (hour < HOUR_START || hour >= HOUR_END) return;
    onSlotClick(day, hour, minute);
  };

  const beginDrag = (
    event: TimedGridEvent,
    dayKey: string,
    originTop: number,
    e: React.MouseEvent,
  ) => {
    if (!isDraggable(event) || !onReschedule) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { event, dayKey, startY: e.clientY, originTop };
    setDraggingId(event.id);
    setDragOffsetPx(0);
    setDragError(null);

    const onMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;
      setDragOffsetPx(moveEvent.clientY - dragRef.current.startY);
    };

    const onUp = async (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const ctx = dragRef.current;
      dragRef.current = null;
      setDraggingId(null);
      setDragOffsetPx(0);
      if (!ctx || !onReschedule || !ctx.event.startsAt) return;

      const deltaMinutes = snapMinutes(((upEvent.clientY - ctx.startY) / PX_PER_HOUR) * 60);
      if (deltaMinutes === 0) return;

      const duration = Math.max(ctx.event.durationMinutes ?? 60, 15);
      const originParts = nairobiTimeParts(ctx.event.startsAt);
      const originTotal = originParts.hour * 60 + originParts.minute;
      const nextTotal = Math.max(
        HOUR_START * 60,
        Math.min(HOUR_END * 60 - duration, originTotal + deltaMinutes),
      );
      const startLabel = minutesToTimeLabel(nextTotal);
      const endLabel = minutesToTimeLabel(nextTotal + duration);
      const startsAt = parseDateTimeAsNairobi(`${ctx.dayKey}T${startLabel}`);
      const endsAt = parseDateTimeAsNairobi(`${ctx.dayKey}T${endLabel}`);
      try {
        await onReschedule(ctx.event, startsAt.toISOString(), endsAt.toISOString());
      } catch (err) {
        setDragError(err instanceof Error ? err.message : 'Could not reschedule.');
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="min-w-0">
      {dragError ? (
        <p className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">{dragError}</p>
      ) : null}
      <div
        className="grid min-w-[40rem]"
        style={{
          gridTemplateColumns: singleDay
            ? '3.5rem minmax(0, 1fr)'
            : `3.5rem repeat(${days.length}, minmax(0, 1fr))`,
        }}
      >
        <div className="border-b border-r border-neutral-200 bg-neutral-50" />
        {columns.map(({ day, key }) => (
          <div
            key={`head-${key}`}
            className={`border-b border-r border-neutral-200 bg-neutral-50 px-2 py-2 text-center ${
              key === todayKey ? 'bg-primary-50' : ''
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {formatInNairobi(day, { weekday: 'short' })}
            </p>
            <p
              className={`mt-0.5 text-sm font-semibold ${
                key === todayKey ? 'text-primary-900' : 'text-neutral-800'
              }`}
            >
              {day.getUTCDate()}
            </p>
          </div>
        ))}

        <div className="border-b border-r border-neutral-100 bg-neutral-50 px-1 py-1 text-[10px] font-semibold text-neutral-500">
          All day
        </div>
        {columns.map(({ key, allDay }) => (
          <div
            key={`allday-${key}`}
            className="min-h-10 space-y-1 border-b border-r border-neutral-100 bg-neutral-50/80 p-1"
          >
            {allDay.map((event) => (
              <button
                key={event.id}
                type="button"
                data-cal-timed-event
                onClick={() => onSelect(event)}
                className={`block w-full truncate rounded border px-1.5 py-0.5 text-left text-[10px] font-semibold ${eventTone(event)} ${
                  selectedId === event.id ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                {event.title}
              </button>
            ))}
          </div>
        ))}

        <div className="relative border-r border-neutral-100 bg-neutral-50" style={{ height: GRID_HEIGHT }}>
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-neutral-100 px-1 text-[10px] font-medium text-neutral-400"
              style={{ top: (hour - HOUR_START) * PX_PER_HOUR }}
            >
              {pad(hour)}:00
            </div>
          ))}
        </div>

        {columns.map(({ day, key, laidOut }) => (
          <div
            key={`lane-${key}`}
            role="presentation"
            onClick={(e) => onLaneClick(day, e)}
            className="relative cursor-pointer border-r border-neutral-100 bg-white hover:bg-primary-50/20"
            style={{ height: GRID_HEIGHT }}
          >
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="pointer-events-none absolute left-0 right-0 border-t border-neutral-100"
                style={{ top: (hour - HOUR_START) * PX_PER_HOUR, height: PX_PER_HOUR }}
              />
            ))}
            {laidOut.map(({ event, top, height, col, colCount }) => {
              const widthPct = 100 / colCount;
              const leftPct = col * widthPct;
              const isDragging = draggingId === event.id;
              const displayTop = isDragging ? top + dragOffsetPx : top;
              const canDrag = isDraggable(event) && Boolean(onReschedule);
              return (
                <button
                  key={event.id}
                  type="button"
                  data-cal-timed-event
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(event);
                  }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    beginDrag(event, key, top, e);
                  }}
                  className={`absolute z-10 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[10px] leading-tight shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:text-xs ${eventTone(event)} ${
                    selectedId === event.id ? 'ring-2 ring-primary-500' : ''
                  } ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                    isDragging ? 'opacity-90 shadow-md' : ''
                  }`}
                  style={{
                    top: displayTop,
                    height,
                    left: `calc(${leftPct}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                  }}
                  title={
                    canDrag
                      ? `${event.title} (drag to reschedule)`
                      : event.title
                  }
                >
                  <span className="block truncate font-semibold">
                    {event.startsAt
                      ? formatInNairobi(new Date(event.startsAt), {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })
                      : ''}{' '}
                    · {event.title}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
