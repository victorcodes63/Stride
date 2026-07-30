'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  ListFilter,
  ListTodo,
  MapPinned,
  Plus,
  Share2,
  StickyNote,
  Video,
  X,
} from 'lucide-react';
import { APP_TIMEZONE, formatInNairobi, parseDateTimeAsNairobi, toDateTimeLocalNairobi } from '@/lib/timezone';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import CalendarQuickAdd from '@/components/calendar/CalendarQuickAdd';
import CalendarShareDialog from '@/components/calendar/CalendarShareDialog';
import CalendarTimedGrid from '@/components/calendar/CalendarTimedGrid';
import CalendarAgendaStrip from '@/components/dashboard/CalendarAgendaStrip';
import AppActionButton from '@/components/ui/AppActionButton';
import AppSelect from '@/components/ui/AppSelect';
import BrandLoader from '@/components/ui/BrandLoader';
import ContentCard from '@/components/ui/ContentCard';
import FilterBar from '@/components/ui/FilterBar';
import InlineAlert from '@/components/ui/InlineAlert';
import {
  readIncludeCompanyPreference,
  writeIncludeCompanyPreference,
} from '@/lib/calendar-company-merge';

type CalendarKind =
  | 'interview'
  | 'break'
  | 'task'
  | 'leave'
  | 'personal'
  | 'focus'
  | 'company'
  | 'birthday'
  | 'note'
  | 'reminder'
  | 'shared';
type CalendarEvent = {
  id: string;
  sourceId?: string;
  kind: CalendarKind;
  startsAt?: string;
  startDate?: string;
  endDate?: string;
  allDay?: boolean;
  durationMinutes?: number;
  title: string;
  notes?: string | null;
  client?: string;
  type?: 'phone' | 'video' | 'onsite' | 'break' | string;
  status: string;
  label?: string;
  priority?: string;
  color?: string | null;
  recurrence?: string;
  reminderMinutes?: number | null;
  linkedTaskId?: string | null;
  creatorId?: string;
  eventScope?: 'personal' | 'company' | 'shared';
  canManage?: boolean;
  ownerId?: string;
  ownerName?: string;
  shareId?: string;
  participants?: Array<{ userId: string; name: string; status: 'pending' | 'accepted' | 'declined'; respondedAt?: string | null }>;
  currentUserParticipantStatus?: 'pending' | 'accepted' | 'declined' | null;
};
type StaffOption = { id: string; name: string; email: string };

type PlannerView = 'month' | 'week' | 'day' | 'fortnight';
type CalendarScope = 'personal' | 'company';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const VIEW_ORDER: PlannerView[] = ['day', 'week', 'fortnight', 'month'];
const VIEW_LABELS: Record<PlannerView, string> = {
  day: 'Day',
  week: 'Week',
  fortnight: 'Fortnight',
  month: 'Month',
};

function toDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function currentNairobiDate() {
  const [year, month, day] = toDateKey(new Date()).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function mondayOf(date: Date) {
  return addDays(date, -((date.getUTCDay() + 6) % 7));
}

type MonthRangeMode = 'focused' | 'full';

/**
 * Month grid for the planner.
 * focused — current month starts at today's week (hide past weeks).
 * full — classic full month including past days.
 */
function monthDays(
  anchor: Date,
  mode: MonthRangeMode = 'focused',
  today = currentNairobiDate(),
) {
  const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const last = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  const monthStart = mondayOf(first);
  const monthEnd = addDays(mondayOf(last), 6);
  const sameMonth =
    anchor.getUTCFullYear() === today.getUTCFullYear() &&
    anchor.getUTCMonth() === today.getUTCMonth();
  const start = mode === 'focused' && sameMonth ? mondayOf(today) : monthStart;

  const days: Date[] = [];
  for (let cursor = new Date(start); cursor <= monthEnd; cursor = addDays(cursor, 1)) {
    days.push(new Date(cursor));
  }
  while (days.length % 7 !== 0) {
    days.push(addDays(days[days.length - 1], 1));
  }
  return days;
}

function plannerDays(view: PlannerView, anchor: Date, monthMode: MonthRangeMode = 'focused') {
  if (view === 'month') return monthDays(anchor, monthMode);
  if (view === 'week') return Array.from({ length: 7 }, (_, index) => addDays(mondayOf(anchor), index));
  if (view === 'fortnight') return Array.from({ length: 14 }, (_, index) => addDays(mondayOf(anchor), index));
  return [anchor];
}

function eventDate(event: CalendarEvent) {
  return event.startsAt ? toDateKey(new Date(event.startsAt)) : event.startDate;
}

function eventTone(event: CalendarEvent) {
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
  if (event.kind === 'break') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (event.kind === 'focus') return 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900';
  if (event.kind === 'personal') return 'border-cyan-200 bg-cyan-50 text-cyan-900';
  if (event.kind === 'birthday') return 'border-pink-200 bg-pink-50 text-pink-900';
  if (event.kind === 'company') return 'border-orange-200 bg-orange-50 text-orange-900';
  if (event.kind === 'shared') return 'border-violet-200 bg-violet-50 text-violet-950';
  if (event.status === 'cancelled') return 'border-neutral-200 bg-neutral-100 text-neutral-600';
  if (event.status === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return 'border-indigo-200 bg-indigo-50 text-indigo-900';
}

function typeLabel(event: CalendarEvent) {
  if (event.kind === 'leave') return 'Leave';
  if (event.kind === 'note') return 'Quick note';
  if (event.kind === 'reminder') return 'Reminder';
  if (event.kind === 'task') return 'Assigned task';
  if (event.kind === 'break') return 'Protected break';
  if (event.kind === 'focus') return 'Focus block';
  if (event.kind === 'personal') return 'Personal event';
  if (event.kind === 'company') return event.type?.replaceAll('_', ' ') ?? 'Company event';
  if (event.kind === 'shared') return event.ownerName ? `${event.ownerName}'s calendar` : 'Shared calendar';
  if (event.kind === 'birthday') return 'Birthday';
  return event.type === 'onsite' ? 'On-site interview' : `${event.type ?? 'Interview'} interview`;
}

function periodTitle(view: PlannerView, days: Date[]) {
  if (view === 'month') {
    return new Intl.DateTimeFormat('en-KE', { month: 'long', year: 'numeric', timeZone: APP_TIMEZONE }).format(days[14]);
  }
  const formatter = new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: APP_TIMEZONE });
  return days.length === 1 ? formatter.format(days[0]) : `${formatter.format(days[0])} – ${formatter.format(days[days.length - 1])}`;
}

function scopeFromSearchParams(params: URLSearchParams): CalendarScope {
  const scopeParam = params.get('scope');
  if (scopeParam === 'company' || scopeParam === 'personal') return scopeParam;
  if (params.has('event')) return 'company';
  if (params.has('shared') || params.has('task')) return 'personal';
  return 'personal';
}

export default function CalendarPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // URL is the single source of truth — nav soft-loads never leave a stale Personal scope.
  const scope = scopeFromSearchParams(new URLSearchParams(searchParams.toString()));
  const [plannerView, setPlannerView] = useState<PlannerView>(() => {
    if (typeof window === 'undefined') return 'week';
    const viewParam = new URLSearchParams(window.location.search).get('view');
    if (viewParam === 'day' || viewParam === 'week' || viewParam === 'fortnight' || viewParam === 'month') {
      return viewParam;
    }
    return 'week';
  });
  const [anchor, setAnchor] = useState(() => {
    if (typeof window === 'undefined') return currentNairobiDate();
    const dateParam = new URLSearchParams(window.location.search).get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [year, month, day] = dateParam.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    }
    return currentNairobiDate();
  });
  const [focusSharedOwnerId, setFocusSharedOwnerId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('shared');
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarWarnings, setCalendarWarnings] = useState<string[]>([]);
  const [kindFilter, setKindFilter] = useState<'all' | CalendarKind>(() => {
    if (typeof window === 'undefined') return 'all';
    return new URLSearchParams(window.location.search).has('shared') ? 'shared' : 'all';
  });
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editingScope, setEditingScope] = useState<CalendarScope | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [staffQuery, setStaffQuery] = useState('');
  const [draft, setDraft] = useState({
    title: '',
    eventType: 'meeting',
    startsAt: '',
    endsAt: '',
    notes: '',
    recurrence: 'none',
    reminderMinutes: '',
    isFocusBlock: false,
    priority: 'none',
    participantIds: [] as string[],
  });
  const [reloadToken, setReloadToken] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [monthRangeMode, setMonthRangeMode] = useState<MonthRangeMode>('focused');
  const [includeCompany, setIncludeCompany] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const [quickAdd, setQuickAdd] = useState<{
    dateKey: string;
    hour: number | null;
    minute: number;
  } | null>(null);
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const days = useMemo(
    () => plannerDays(plannerView, anchor, monthRangeMode),
    [plannerView, anchor, monthRangeMode],
  );
  const viewingCurrentMonth =
    anchor.getUTCFullYear() === currentNairobiDate().getUTCFullYear() &&
    anchor.getUTCMonth() === currentNairobiDate().getUTCMonth();
  const range = useMemo(() => ({ start: toDateKey(days[0]), end: toDateKey(days[days.length - 1]) }), [days]);
  const today = toDateKey(currentNairobiDate());
  const filtersActive = kindFilter !== 'all' || statusFilter !== 'all' || Boolean(focusSharedOwnerId);

  useEffect(() => {
    setIncludeCompany(readIncludeCompanyPreference());
  }, []);

  // Canonicalize missing/invalid scope + honor shared deep-links.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const nextScope = scopeFromSearchParams(params);

    if (params.has('shared')) {
      setFocusSharedOwnerId(params.get('shared'));
      setKindFilter('shared');
    }

    if (params.get('scope') !== nextScope) {
      params.set('scope', nextScope);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const feedPath =
      scope === 'personal'
        ? `personal-events?start=${range.start}&end=${range.end}${includeCompany ? '&includeCompany=1' : ''}`
        : `company-events?start=${range.start}&end=${range.end}`;
    fetch(`/api/calendar/${feedPath}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load calendar events.');
        return data as { events?: CalendarEvent[] };
      })
      .then((data) => {
        const loaded = Array.isArray(data.events) ? data.events : [];
        setEvents(loaded);
        const params = new URLSearchParams(searchParams.toString());
        const eventId = params.get('event');
        const taskId = params.get('task');
        const itemId = params.get('item');
        const sharedOwnerId = params.get('shared');
        setSelected((current) => {
          if (itemId) {
            return loaded.find((item) => item.sourceId === itemId) ?? current;
          }
          if (taskId) {
            return (
              loaded.find((item) => item.kind === 'task' && (item.sourceId === taskId || item.id === `task:${taskId}`)) ??
              current
            );
          }
          if (eventId) return loaded.find((item) => item.sourceId === eventId) ?? null;
          if (sharedOwnerId) {
            return (
              loaded.find(
                (item) => item.kind === 'shared' && item.ownerId === sharedOwnerId,
              ) ?? null
            );
          }
          if (!current?.sourceId && !current?.id) return current;
          return loaded.find((item) => item.sourceId === current?.sourceId || item.id === current?.id) ?? null;
        });
        if (taskId) setKindFilter((prev) => (prev === 'all' ? 'task' : prev));
      })
      .catch((fetchError: Error) => {
        if (fetchError.name !== 'AbortError') setError(fetchError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [scope, range, reloadToken, searchParams, includeCompany]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [filtersOpen]);

  useEffect(() => {
    if (!editorOpen || scope !== 'company') return;
    const controller = new AbortController();
    fetch(`/api/calendar/staff?q=${encodeURIComponent(staffQuery)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setStaff(Array.isArray(data.staff) ? data.staff : []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [editorOpen, scope, staffQuery]);

  const visibleEvents = useMemo(
    () =>
      events.filter((event) => {
        if (kindFilter !== 'all' && event.kind !== kindFilter) return false;
        if (statusFilter !== 'all' && event.status !== statusFilter) return false;
        if (
          focusSharedOwnerId &&
          event.kind === 'shared' &&
          event.ownerId &&
          event.ownerId !== focusSharedOwnerId
        ) {
          return false;
        }
        return true;
      }),
    [events, kindFilter, statusFilter, focusSharedOwnerId],
  );

  const focusedShareOwnerName = useMemo(() => {
    if (!focusSharedOwnerId) return null;
    return (
      events.find((event) => event.kind === 'shared' && event.ownerId === focusSharedOwnerId)
        ?.ownerName ?? null
    );
  }, [events, focusSharedOwnerId]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    visibleEvents.forEach((event) => {
      if (event.allDay && event.startDate && event.endDate) {
        for (let day = new Date(`${event.startDate}T00:00:00Z`); toDateKey(day) <= event.endDate; day = addDays(day, 1)) {
          const key = toDateKey(day);
          map.set(key, [...(map.get(key) ?? []), event]);
        }
      } else {
        const key = eventDate(event);
        if (key) map.set(key, [...(map.get(key) ?? []), event]);
      }
    });
    return map;
  }, [visibleEvents]);

  const statusOptions = scope === 'personal'
    ? ['all', 'todo', 'in_progress', 'done', 'pending', 'approved', 'scheduled', 'completed', 'cancelled']
    : ['all', 'scheduled', 'completed', 'cancelled'];
  const kindFilterOptions: Array<{ value: 'all' | CalendarKind; label: string }> =
    scope === 'personal'
      ? [
          { value: 'all', label: 'All events' },
          { value: 'personal', label: 'Personal' },
          { value: 'focus', label: 'Focus blocks' },
          { value: 'note', label: 'Notes' },
          { value: 'reminder', label: 'Reminders' },
          { value: 'task', label: 'Tasks' },
          { value: 'leave', label: 'Leave' },
          { value: 'interview', label: 'Interviews' },
          { value: 'company', label: 'Company' },
          { value: 'shared', label: 'Shared with me' },
          { value: 'birthday', label: 'Birthdays' },
          { value: 'break', label: 'Breaks' },
        ]
      : [
          { value: 'all', label: 'All events' },
          { value: 'company', label: 'Company' },
          { value: 'note', label: 'Shared notes' },
          { value: 'interview', label: 'Interviews' },
          { value: 'break', label: 'Breaks' },
          { value: 'birthday', label: 'Birthdays' },
        ];
  const shift = (direction: number) => {
    setAnchor((previous) => {
      if (plannerView === 'month') {
        return new Date(Date.UTC(previous.getUTCFullYear(), previous.getUTCMonth() + direction, 1));
      }
      const amount = plannerView === 'fortnight' ? direction * 14 : plannerView === 'week' ? direction * 7 : direction;
      return addDays(previous, amount);
    });
  };
  const writeScopeToUrl = (nextScope: CalendarScope, options?: { clearShared?: boolean }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('scope', nextScope);
    if (options?.clearShared) params.delete('shared');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const selectScope = (nextScope: CalendarScope) => {
    if (nextScope === scope) return;
    setKindFilter('all');
    setStatusFilter('all');
    setFocusSharedOwnerId(null);
    writeScopeToUrl(nextScope, { clearShared: true });
  };

  const clearSharedFocus = () => {
    setFocusSharedOwnerId(null);
    setKindFilter('all');
    writeScopeToUrl(scope === 'company' ? 'company' : 'personal', { clearShared: true });
  };
  const openQuickAdd = (day: Date, hour: number | null = 9, minute = 0) => {
    setAnchor(day);
    setQuickAdd({ dateKey: toDateKey(day), hour, minute });
  };
  const openCreate = () => openQuickAdd(anchor, 9, 0);

  const handleReschedule = async (
    event: CalendarEvent,
    nextStartsAtIso: string,
    nextEndsAtIso: string,
  ) => {
    if (!event.sourceId) return;
    setRescheduleError(null);
    const payload = {
      scope: 'personal' as const,
      kind: 'event' as const,
      title: event.title,
      startsAt: nextStartsAtIso,
      endsAt: nextEndsAtIso,
      notes: event.notes || undefined,
      recurrence: event.recurrence ?? 'none',
      reminderMinutes: event.reminderMinutes ?? null,
      isFocusBlock: event.kind === 'focus',
      priority: event.priority ?? 'none',
    };
    const response = await fetch(`/api/calendar/events/${event.sourceId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error ?? 'Could not reschedule.';
      setRescheduleError(message);
      throw new Error(message);
    }
    setReloadToken((token) => token + 1);
    setSelected((current) =>
      current?.id === event.id
        ? {
            ...current,
            startsAt: nextStartsAtIso,
            durationMinutes: Math.round(
              (new Date(nextEndsAtIso).getTime() - new Date(nextStartsAtIso).getTime()) / 60_000,
            ),
          }
        : current,
    );
  };
  const openEdit = () => {
    if (!selected?.sourceId || !selected.startsAt) return;
    const startIso = selected.startsAt;
    const endIso = new Date(new Date(selected.startsAt).getTime() + (selected.durationMinutes ?? 60) * 60_000).toISOString();
    setDraft({
      title: selected.title,
      eventType: selected.type ?? 'meeting',
      startsAt: toDateTimeLocalNairobi(startIso),
      endsAt: toDateTimeLocalNairobi(endIso),
      notes: selected.notes ?? '',
      recurrence: selected.recurrence ?? 'none',
      reminderMinutes: selected.reminderMinutes?.toString() ?? '',
      isFocusBlock: selected.kind === 'focus',
      priority: selected.priority ?? 'none',
      participantIds: selected.participants?.map((participant) => participant.userId) ?? [],
    });
    const nextScope =
      selected.eventScope === 'company' || selected.eventScope === 'personal'
        ? selected.eventScope
        : scope;
    setEditingSourceId(selected.sourceId);
    setEditingScope(nextScope);
    setFormError(null);
    setCalendarWarnings([]);
    setSelected(null);
    setEditorOpen(true);
  };
  const submitEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const startsAt = parseDateTimeAsNairobi(draft.startsAt);
    const endsAt = parseDateTimeAsNairobi(draft.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setSaving(false);
      setFormError('Enter valid start and end times.');
      return;
    }
    const saveScope = editingScope ?? scope;
    const payload = {
      scope: saveScope,
      kind: 'event' as const,
      title: draft.title,
      eventType: draft.eventType,
      notes: draft.notes || undefined,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      recurrence: draft.recurrence,
      reminderMinutes: draft.reminderMinutes ? Number(draft.reminderMinutes) : null,
      isFocusBlock: draft.isFocusBlock,
      participantIds: draft.participantIds,
      ...(saveScope === 'personal' ? { priority: draft.priority } : {}),
    };
    try {
      const response = await fetch(
        editingSourceId ? `/api/calendar/events/${editingSourceId}` : '/api/calendar/events',
        {
          method: editingSourceId ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const conflictTitles = Array.isArray(data.conflicts)
          ? data.conflicts
              .map((conflict: { title?: string }) => conflict.title)
              .filter(Boolean)
              .slice(0, 3)
          : [];
        setFormError(
          conflictTitles.length
            ? `${data.error ?? 'Schedule conflict.'} Overlaps: ${conflictTitles.join(', ')}`
            : (data.error ?? 'Could not save event.'),
        );
        return;
      }
      setEditorOpen(false);
      setEditingScope(null);
      setAnchor(new Date(Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), startsAt.getUTCDate())));
      setCalendarWarnings(
        Array.isArray(data.conflicts)
          ? data.conflicts.map((conflict: { title: string }) => conflict.title)
          : [],
      );
      setSelected({
        id: `${saveScope === 'company' ? 'company' : 'personal'}:${data.event.id}`,
        sourceId: data.event.id,
        kind: saveScope === 'company' ? 'company' : draft.isFocusBlock ? 'focus' : 'personal',
        title: data.event.title,
        startsAt: data.event.startsAt,
        durationMinutes: Math.round(
          (new Date(data.event.endsAt).getTime() - new Date(data.event.startsAt).getTime()) / 60_000,
        ),
        status: data.event.status,
        type: data.event.eventType,
        recurrence: data.event.recurrence,
        reminderMinutes: data.event.reminderMinutes ?? null,
        canManage: true,
        eventScope: saveScope,
        participants: data.event.participants?.map(
          (participant: {
            userId: string;
            status: 'pending' | 'accepted' | 'declined';
            respondedAt?: string | null;
            user: { name: string };
          }) => ({
            userId: participant.userId,
            name: participant.user.name,
            status: participant.status,
            respondedAt: participant.respondedAt,
          }),
        ),
      });
      setReloadToken((token) => token + 1);
    } catch {
      setFormError('Could not save event. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };
  const respondToInvitation = async (status: 'accepted' | 'declined') => {
    if (!selected?.sourceId) return;
    const response = await fetch(`/api/calendar/events/${selected.sourceId}/response`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? 'Could not update your response.'); return; }
    const participantId = data.participant.userId as string;
    const applyResponse = (item: CalendarEvent) => ({
      ...item,
      currentUserParticipantStatus: status,
      participants: item.participants?.map((participant) => participant.userId === participantId ? { ...participant, status, respondedAt: data.participant.respondedAt } : participant),
    });
    setEvents((items) => items.map((item) => item.sourceId === selected.sourceId ? applyResponse(item) : item));
    setSelected((current) => current ? applyResponse(current) : current);
  };
  const cancelSelected = async () => {
    if (
      !selected?.sourceId ||
      !['personal', 'focus', 'company', 'note', 'reminder'].includes(selected.kind)
    ) {
      return;
    }
    if (selected.eventScope === 'company' && !selected.canManage) {
      setError('You do not have permission to remove this shared item.');
      return;
    }
    let url = `/api/calendar/events/${selected.sourceId}`;
    if (selected.kind === 'reminder' && selected.linkedTaskId) {
      const alsoCancelTask = window.confirm(
        'Also cancel the linked task in My tasks? Choose Cancel to keep the task.',
      );
      if (alsoCancelTask) url += '?cancelTask=1';
    }
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? 'Could not cancel this item.');
      return;
    }
    setEvents((items) =>
      items.map((item) =>
        item.sourceId === selected.sourceId ? { ...item, status: 'cancelled' } : item,
      ),
    );
    setSelected({ ...selected, status: 'cancelled' });
    setReloadToken((token) => token + 1);
  };

  const completeLinkedTask = async () => {
    if (!selected?.linkedTaskId) return;
    const response = await fetch(`/api/staff/tasks/${selected.linkedTaskId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Could not complete linked task.');
      return;
    }
    setReloadToken((token) => token + 1);
  };

  return (
    <DashboardPage>
      <DashboardPageHeader
        title={scope === 'personal' ? 'My calendar' : 'Company calendar'}
        icon={CalendarDays}
        description={
          scope === 'personal'
            ? 'Personal events, reminders, leave, and shared calendars.'
            : 'Company events, notes, and invitations.'
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg bg-neutral-100 p-1" role="group" aria-label="Calendar scope">
              {(['personal', 'company'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => selectScope(option)}
                  aria-pressed={scope === option}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                    scope === option
                      ? 'bg-white text-primary-900 shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {option === 'personal' ? 'Personal' : 'Company'}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {error ? (
        <InlineAlert tone="error" className="mb-5">
          {error}
        </InlineAlert>
      ) : null}
      {calendarWarnings.length ? (
        <InlineAlert tone="warning" className="mb-5">
          <p className="font-semibold">Event saved with scheduling warnings</p>
          <ul className="mt-1 list-disc pl-5">
            {[...new Set(calendarWarnings)].map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </InlineAlert>
      ) : null}
      {focusSharedOwnerId ? (
        <InlineAlert tone="info" className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              Showing shared calendar
              {focusedShareOwnerName ? (
                <>
                  {' '}
                  from <span className="font-semibold">{focusedShareOwnerName}</span>
                </>
              ) : null}
              . Sticky notes from their calendar stay private.
            </p>
            <button
              type="button"
              onClick={clearSharedFocus}
              className="text-sm font-semibold text-primary-800 hover:underline"
            >
              Show full calendar
            </button>
          </div>
        </InlineAlert>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)] xl:gap-x-5 xl:gap-y-3 2xl:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)] 2xl:gap-x-6">
        <div className="min-w-0 space-y-3">
        <FilterBar
          label="Planner"
          className={filtersOpen ? 'relative z-40' : undefined}
          trailing={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className={`relative ${filtersOpen ? 'z-50' : ''}`} ref={filtersRef}>
                <button
                  type="button"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={filtersOpen}
                  aria-haspopup="dialog"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    filtersActive || filtersOpen || includeCompany
                      ? 'border-primary-300 bg-primary-50 text-primary-900'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <ListFilter className="h-4 w-4" />
                  Filters
                  {filtersActive || (scope === 'personal' && includeCompany) ? (
                    <span className="rounded-md bg-primary-800 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {
                        [
                          kindFilter !== 'all',
                          statusFilter !== 'all',
                          scope === 'personal' && includeCompany,
                        ].filter(Boolean).length
                      }
                    </span>
                  ) : null}
                </button>
                {filtersOpen ? (
                  <div
                    role="dialog"
                    aria-label="Calendar filters"
                    className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-xl"
                  >
                    <div className="space-y-3.5">
                      {scope === 'personal' ? (
                        <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2.5">
                          <label className="flex cursor-pointer items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={includeCompany}
                              onChange={(event) => {
                                const next = event.target.checked;
                                setIncludeCompany(next);
                                writeIncludeCompanyPreference(next);
                              }}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-primary-700 focus:ring-primary-400"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-neutral-900">
                                Show company calendar
                              </span>
                              <span className="mt-0.5 block text-xs leading-snug text-neutral-500">
                                Merge all interviews and company events into this view. Your assigned
                                interviews still show when this is off.
                              </span>
                            </span>
                          </label>
                        </div>
                      ) : null}
                      <AppSelect
                        value={kindFilter}
                        onChange={(value) => setKindFilter(value as typeof kindFilter)}
                        options={kindFilterOptions}
                        label="Event type"
                        className="w-full"
                        density="compact"
                      />
                      <AppSelect
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value as string)}
                        options={statusOptions.map((status) => ({
                          value: status,
                          label: status === 'all' ? 'All statuses' : status.replace('_', ' '),
                        }))}
                        label="Status"
                        className="w-full"
                        density="compact"
                      />
                      <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                        <button
                          type="button"
                          disabled={!filtersActive && !(scope === 'personal' && includeCompany)}
                          onClick={() => {
                            setKindFilter('all');
                            setStatusFilter('all');
                            clearSharedFocus();
                            if (scope === 'personal' && includeCompany) {
                              setIncludeCompany(false);
                              writeIncludeCompanyPreference(false);
                            }
                          }}
                          className="text-xs font-semibold text-neutral-500 hover:text-primary-800 disabled:opacity-40"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltersOpen(false)}
                          className="rounded-lg bg-primary-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-900"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              {scope === 'personal' ? (
                <AppActionButton
                  variant="outline"
                  icon={Share2}
                  label="Share"
                  onClick={() => setShareOpen(true)}
                  aria-haspopup="dialog"
                />
              ) : null}
              <AppActionButton
                variant="accent"
                icon={Plus}
                label="Add"
                onClick={openCreate}
                aria-haspopup="dialog"
                className="shrink-0"
              />
            </div>
          }
        >
          <button
            type="button"
            onClick={() => shift(-1)}
            className="rounded-lg border border-neutral-200 p-2 text-neutral-700 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={`Previous ${VIEW_LABELS[plannerView].toLowerCase()}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(currentNairobiDate())}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="rounded-lg border border-neutral-200 p-2 text-neutral-700 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={`Next ${VIEW_LABELS[plannerView].toLowerCase()}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-1 text-base font-semibold text-primary-900 sm:text-lg">
            {periodTitle(plannerView, days)}
          </h2>
        </FilterBar>

        <div className="flex flex-col gap-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white bg-clip-padding p-2 shadow-sm sm:p-2.5">
          <div
            className="grid w-full grid-cols-2 gap-1 overflow-hidden rounded-lg bg-neutral-100 p-1 sm:grid-cols-4"
            role="group"
            aria-label="Calendar view"
          >
            {VIEW_ORDER.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPlannerView(option)}
                aria-pressed={plannerView === option}
                className={`rounded-md px-2 py-2 text-center text-xs font-semibold sm:text-sm ${
                  plannerView === option
                    ? 'bg-white text-primary-900 shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {VIEW_LABELS[option]}
              </button>
            ))}
          </div>
          {plannerView === 'month' && viewingCurrentMonth ? (
            <div
              className="inline-flex w-full max-w-sm self-end overflow-hidden rounded-lg bg-neutral-100 p-1 sm:w-auto"
              role="group"
              aria-label="Month range"
            >
              {(
                [
                  { id: 'focused' as const, label: 'Focused', hint: 'Today onward' },
                  { id: 'full' as const, label: 'Full month', hint: 'Include past days' },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  title={option.hint}
                  onClick={() => setMonthRangeMode(option.id)}
                  aria-pressed={monthRangeMode === option.id}
                  className={`flex-1 rounded-md px-3 py-1.5 text-center text-xs font-semibold sm:flex-none ${
                    monthRangeMode === option.id
                      ? 'bg-white text-primary-900 shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {rescheduleError ? (
          <InlineAlert tone="error" className="mb-0">
            {rescheduleError}
          </InlineAlert>
        ) : null}

        <ContentCard padding="none" className="relative overflow-auto">
          <div className="relative overflow-auto">
          {plannerView === 'week' || plannerView === 'day' ? (
            <CalendarTimedGrid
              days={days}
              todayKey={today}
              toDateKey={toDateKey}
              eventsByDate={eventsByDate}
              selectedId={selected?.id}
              singleDay={plannerView === 'day'}
              onSelect={(event) => setSelected(event as CalendarEvent)}
              onSlotClick={(day, hour, minute) => openQuickAdd(day, hour, minute)}
              onReschedule={
                scope === 'personal'
                  ? (event, startsAt, endsAt) =>
                      handleReschedule(event as CalendarEvent, startsAt, endsAt)
                  : undefined
              }
            />
          ) : (
            <>
          <div className={`grid min-w-[40rem] grid-cols-7 border-b border-neutral-200 bg-neutral-50`}>
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                {day}
              </div>
            ))}
          </div>
          <div className="grid min-w-[40rem] grid-cols-7">
            {days.map((day) => {
              const key = toDateKey(day);
              const dayEvents = eventsByDate.get(key) ?? [];
              const inMonth = day.getUTCMonth() === anchor.getUTCMonth();
              const limit = plannerView === 'month' ? 3 : 8;
              const overflow = dayEvents.length - limit;
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[data-cal-item]')) return;
                    openQuickAdd(day, 9, 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openQuickAdd(day, 9, 0);
                    }
                  }}
                  className={`relative border-b border-r border-neutral-100 p-1.5 text-left ${plannerView === 'month' ? 'min-h-24 sm:min-h-28' : 'min-h-64 p-2'} ${plannerView === 'month' && !inMonth ? 'bg-neutral-50/70' : 'bg-white'} cursor-pointer hover:bg-primary-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500`}
                >
                  <div className={`mb-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${key === today ? 'bg-primary-800 text-white' : inMonth || plannerView !== 'month' ? 'text-neutral-700' : 'text-neutral-400'}`}>
                    {day.getUTCDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, limit).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        data-cal-item
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(event);
                        }}
                        className={`block w-full rounded-md border px-1.5 py-1 text-left text-[10px] leading-tight transition-shadow hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-xs ${eventTone(event)}`}
                      >
                        <span className="block truncate font-semibold">
                          {event.kind === 'note'
                            ? 'Note'
                            : event.kind === 'reminder'
                              ? 'Remind'
                              : event.allDay
                                ? 'All day'
                                : event.startsAt
                                  ? formatInNairobi(new Date(event.startsAt), {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: false,
                                    })
                                  : ''}{' '}
                          · {event.title}
                        </span>
                        {plannerView !== 'month' ? (
                          <span className="block truncate capitalize opacity-75">
                            {typeLabel(event)} · {event.status.replace('_', ' ')}
                          </span>
                        ) : null}
                      </button>
                    ))}
                    {overflow > 0 ? (
                      <button
                        type="button"
                        data-cal-item
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedDayKey((current) => (current === key ? null : key));
                        }}
                        className="px-1 text-[10px] font-semibold text-primary-700 hover:text-primary-950"
                      >
                        {expandedDayKey === key ? 'Hide' : `Show all (+${overflow})`}
                      </button>
                    ) : null}
                    {expandedDayKey === key ? (
                      <div
                        data-cal-item
                        className="absolute left-1 right-1 z-20 max-h-56 overflow-auto rounded-lg border border-neutral-200 bg-white p-2 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                          {formatInNairobi(day, { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                        <ul className="space-y-1">
                          {dayEvents.map((event) => (
                            <li key={event.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelected(event);
                                  setExpandedDayKey(null);
                                }}
                                className={`block w-full rounded-md border px-1.5 py-1 text-left text-[10px] ${eventTone(event)}`}
                              >
                                <span className="block truncate font-semibold">{event.title}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
            </>
          )}
          {loading ? <BrandLoader variant="contain" label="Loading calendar…" /> : null}
          </div>
        </ContentCard>
        </div>

        <aside className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm xl:min-h-[30rem]">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
            Agenda
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Today first — tap a day pill for that schedule. Due tasks show under Today.
          </p>
          <div className="mt-3">
            <CalendarAgendaStrip
              embedded
              mode="day-picker"
              calendarHref={false}
              hideCalendarLink
              maxItems={20}
              onSelectedDayChange={(dateKey) => {
                const [year, month, day] = dateKey.split('-').map(Number);
                setAnchor(new Date(Date.UTC(year, month - 1, day)));
              }}
              onSelectEvent={(agenda) => {
                const match =
                  events.find(
                    (item) =>
                      item.id === agenda.id ||
                      (agenda.sourceId != null && item.sourceId === agenda.sourceId),
                  ) ?? null;
                setSelected(
                  match ?? {
                    id: agenda.id,
                    sourceId: agenda.sourceId,
                    kind: agenda.kind as CalendarKind,
                    title: agenda.title,
                    status: agenda.status,
                    startsAt: agenda.startsAt,
                    startDate: agenda.startDate,
                    endDate: agenda.endDate,
                    allDay: agenda.allDay,
                    priority: agenda.priority,
                  },
                );
              }}
            />
          </div>
        </aside>
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Event details"
            className="max-h-[min(40rem,90vh)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
                Event details
              </h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                aria-label="Close details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div className={`rounded-xl border p-3 ${eventTone(selected)}`}>
                <div className="flex items-center gap-2">
                  {selected.kind === 'note' ? (
                    <StickyNote className="h-4 w-4" />
                  ) : selected.kind === 'reminder' ? (
                    <Bell className="h-4 w-4" />
                  ) : selected.kind === 'task' ? (
                    <ListTodo className="h-4 w-4" />
                  ) : selected.kind === 'break' ? (
                    <Coffee className="h-4 w-4" />
                  ) : selected.kind === 'interview' && selected.type === 'video' ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <MapPinned className="h-4 w-4" />
                  )}
                  <p className="text-sm font-semibold">{selected.title}</p>
                </div>
                {selected.client ? <p className="mt-1 text-xs opacity-80">{selected.client}</p> : null}
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex gap-2 text-neutral-700">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                  <span>
                    {selected.allDay
                      ? `${selected.startDate}${selected.endDate && selected.endDate !== selected.startDate ? ` – ${selected.endDate}` : ''}`
                      : selected.startsAt
                        ? formatInNairobi(new Date(selected.startsAt), {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })
                        : ''}
                    <span className="block text-xs text-neutral-500">
                      {selected.allDay
                        ? 'All day · Nairobi time'
                        : `${selected.durationMinutes ?? 'Due'}${selected.durationMinutes ? ' minutes' : ''} · Nairobi time`}
                    </span>
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Type</p>
                  <p className="mt-1 text-neutral-800">{typeLabel(selected)}</p>
                </div>
                {selected.kind === 'shared' ? (
                  <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
                    View-only overlay from a colleague’s shared personal calendar. Sticky notes stay private.
                  </p>
                ) : null}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</p>
                  <p className="mt-1 capitalize text-neutral-800">{selected.status.replace('_', ' ')}</p>
                </div>
                {selected.notes ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{selected.notes}</p>
                  </div>
                ) : null}
                {selected.kind === 'company' ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Participants
                    </p>
                    {selected.participants?.length ? (
                      <ul className="mt-1 space-y-1">
                        {selected.participants.map((participant) => (
                          <li
                            key={participant.userId}
                            className="flex items-center justify-between gap-2 text-sm text-neutral-800"
                          >
                            <span className="truncate">{participant.name}</span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                participant.status === 'accepted'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : participant.status === 'declined'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {participant.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-neutral-500">No targeted participants.</p>
                    )}
                  </div>
                ) : null}
              </div>
              {selected.kind === 'company' &&
              selected.currentUserParticipantStatus === 'pending' &&
              selected.status !== 'cancelled' ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void respondToInvitation('accepted')}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void respondToInvitation('declined')}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Decline
                  </button>
                </div>
              ) : null}
              {selected.sourceId &&
              ['personal', 'focus', 'note', 'reminder'].includes(selected.kind) &&
              selected.status !== 'cancelled' &&
              (selected.eventScope !== 'company' || selected.canManage) ? (
                <div className="grid grid-cols-2 gap-2">
                  {selected.kind === 'personal' || selected.kind === 'focus' ? (
                    <button
                      type="button"
                      onClick={openEdit}
                      className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      Edit
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => void cancelSelected()}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    {selected.kind === 'reminder' || selected.kind === 'note' ? 'Dismiss' : 'Cancel'}
                  </button>
                </div>
              ) : null}
              {selected.sourceId &&
              selected.kind === 'company' &&
              selected.canManage &&
              selected.status !== 'cancelled' ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={openEdit}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Manage
                  </button>
                  <button
                    type="button"
                    onClick={() => void cancelSelected()}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
              {selected.kind === 'interview' ? (
                <>
                  <p className="rounded-lg bg-neutral-50 p-3 text-xs leading-5 text-neutral-600">
                    Candidate, application, meeting-link, and internal-note details are intentionally
                    not shown in this planner.
                  </p>
                  {selected.sourceId ? (
                    <Link
                      href={`/dashboard/interviews?interview=${encodeURIComponent(selected.sourceId)}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-800 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-900"
                    >
                      Open in Interview Management
                    </Link>
                  ) : null}
                </>
              ) : null}
              {selected.kind === 'leave' && selected.sourceId ? (
                <Link
                  href={`/dashboard/staff-leave?application=${encodeURIComponent(selected.sourceId)}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-800 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-900"
                >
                  Open leave request
                </Link>
              ) : null}
              {selected.kind === 'task' && selected.sourceId ? (
                <Link
                  href={`/dashboard/my-tasks?task=${encodeURIComponent(selected.sourceId)}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-800 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-900"
                >
                  <ListTodo className="h-4 w-4" />
                  Open in My tasks
                </Link>
              ) : null}
              {selected.kind === 'reminder' && selected.linkedTaskId ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => void completeLinkedTask()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
                  >
                    Mark linked task done
                  </button>
                  <Link
                    href={`/dashboard/my-tasks?task=${encodeURIComponent(selected.linkedTaskId)}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-800 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-900"
                  >
                    <ListTodo className="h-4 w-4" />
                    Open linked task
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {quickAdd ? (
        <CalendarQuickAdd
          key={`${quickAdd.dateKey}-${quickAdd.hour}-${quickAdd.minute}`}
          open
          scope={scope}
          dateKey={quickAdd.dateKey}
          hour={quickAdd.hour}
          minute={quickAdd.minute}
          onClose={() => setQuickAdd(null)}
          onCreated={() => {
            setQuickAdd(null);
            setReloadToken((token) => token + 1);
          }}
        />
      ) : null}
      <CalendarShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onChanged={() => setReloadToken((token) => token + 1)}
      />
      {editorOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4"><form onSubmit={submitEvent} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-primary-900">{editingSourceId ? 'Edit event' : (editingScope ?? scope) === 'company' ? 'Shared company event' : 'Personal event'}</h2><p className="text-sm text-neutral-500">{(editingScope ?? scope) === 'company' ? 'Visible to all internal staff; selected staff receive an invitation.' : 'Only you can see personal events and focus blocks.'}</p></div><button type="button" onClick={() => { setEditorOpen(false); setEditingScope(null); }} className="text-sm font-medium text-neutral-600">Cancel</button></div>
        {formError ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{formError}</p> : null}
        <label className="block text-sm font-medium text-neutral-700">Title<input required maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" /></label>
        {(editingScope ?? scope) === 'company' ? (
          <AppSelect
            value={draft.eventType}
            onChange={(value) => setDraft({ ...draft, eventType: value as string })}
            options={['bid_submission', 'training', 'meeting', 'public_holiday', 'other'].map((type) => ({
              value: type,
              label: type.replaceAll('_', ' '),
            }))}
            label="Type"
            className="w-full"
          />
        ) : (
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input type="checkbox" checked={draft.isFocusBlock} onChange={(event) => setDraft({ ...draft, isFocusBlock: event.target.checked })} />
            Protected focus block
          </label>
        )}
        {(editingScope ?? scope) === 'company' ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <label className="block min-w-0 flex-1 text-sm font-semibold text-neutral-800">
                Invite internal staff
                <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                  Search and select people to send them an invitation.
                </span>
              </label>
              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/calendar/staff?all=1');
                      const data = await response.json();
                      const allStaff = Array.isArray(data.staff) ? (data.staff as StaffOption[]) : [];
                      setStaff(allStaff);
                      setDraft({
                        ...draft,
                        participantIds: allStaff.map((person) => person.id),
                      });
                      setStaffQuery('');
                    } catch {
                      setFormError('Could not load the full staff list.');
                    }
                  }}
                  className="rounded-lg border border-primary-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary-800 transition-colors hover:bg-primary-50"
                >
                  Select all
                </button>
                {draft.participantIds.length ? (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, participantIds: [] })}
                    className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
            <input
              value={staffQuery}
              onChange={(event) => setStaffQuery(event.target.value)}
              placeholder="Search by name or email"
              className="mt-3 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 shadow-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />
            {draft.participantIds.length ? (
              <div className="mt-3 border-t border-neutral-200 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Invited · {draft.participantIds.length}
                </p>
                <div className="flex max-h-28 flex-wrap gap-2 overflow-auto">
                  {draft.participantIds.map((id) => {
                    const person =
                      staff.find((item) => item.id === id) ??
                      selected?.participants?.find((item) => item.userId === id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            participantIds: draft.participantIds.filter(
                              (participantId) => participantId !== id,
                            ),
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-white px-2.5 py-1 text-xs font-semibold text-primary-800 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Remove ${person?.name ?? 'selected staff'} from invitations`}
                      >
                        {person?.name ?? 'Selected staff'}
                        <span aria-hidden>×</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {staffQuery.trim() ? (
              <div className="mt-3 max-h-44 overflow-auto rounded-lg border border-neutral-200 bg-white">
                {staff
                  .filter((person) => !draft.participantIds.includes(person.id))
                  .map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => {
                        setDraft({
                          ...draft,
                          participantIds: [...draft.participantIds, person.id],
                        });
                        setStaffQuery('');
                      }}
                      className="flex w-full items-center justify-between gap-4 border-b border-neutral-100 px-3 py-3 text-left transition-colors last:border-0 hover:bg-primary-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-neutral-800">
                          {person.name}
                        </span>
                        <span className="block truncate text-xs text-neutral-500">{person.email}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-primary-700">Invite</span>
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-neutral-700">Starts<input required type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" /></label><label className="text-sm font-medium text-neutral-700">Ends<input required type="datetime-local" value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" /></label></div>
        <label className="block text-sm font-medium text-neutral-700">
          Notes
          <textarea
            value={draft.notes}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            rows={3}
            maxLength={4000}
            placeholder="Optional context for invitees"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <AppSelect
            value={draft.recurrence}
            onChange={(value) => setDraft({ ...draft, recurrence: value as string })}
            options={[
              { value: 'none', label: 'Does not repeat' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
            label="Repeat"
            className="w-full"
          />
          <label className="text-sm font-medium text-neutral-700">
            Reminder (minutes)
            <input min="0" max="43200" type="number" value={draft.reminderMinutes} onChange={(event) => setDraft({ ...draft, reminderMinutes: event.target.value })} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" />
          </label>
        </div>
        {(editingScope ?? scope) === 'personal' ? (
          <AppSelect
            value={draft.priority}
            onChange={(value) => setDraft({ ...draft, priority: value as string })}
            options={[
              { value: 'none', label: 'No priority' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
            label="Priority"
            className="w-full"
          />
        ) : null}
        <AppActionButton
          variant="solid"
          type="submit"
          label={saving ? 'Saving…' : 'Save event'}
          loading={saving}
          className="w-full"
        />
      </form></div> : null}
    </DashboardPage>
  );
}
