'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardAsyncState,
  DashboardEmptyState,
  DashboardPageSkeleton,
  type DashboardAsyncStatus,
} from '@/components/dashboard/DashboardAsyncState';
import {
  REGISTER_STATUS_BADGE_CLASS,
  REGISTER_STATUS_LABEL,
  SOURCE_LABEL,
  type ObligationRegisterStatus,
  type ObligationSource,
} from '@/lib/legal/constants';
import { LegalModuleTabs } from '@/components/legal/LegalHubTabs';

type ObligationRow = {
  id: string;
  source: ObligationSource;
  title: string;
  party: string;
  dueDate: string;
  status: ObligationRegisterStatus;
  owner: string | null;
  href: string;
  category?: string | null;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SOURCE_DOT: Record<ObligationSource, string> = {
  contract: 'bg-sky-500',
  credential: 'bg-violet-500',
  policy: 'bg-amber-500',
  compliance: 'bg-[var(--stride-coral)]',
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function LegalCalendarContent() {
  const now = new Date();
  const [rows, setRows] = useState<ObligationRow[]>([]);
  const [status, setStatus] = useState<DashboardAsyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/legal/obligations', { cache: 'no-store' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      const json = (await res.json()) as { obligations?: ObligationRow[] };
      setRows(json.obligations ?? []);
      setStatus('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load compliance calendar.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, ObligationRow[]>();
    for (const row of rows) {
      const key = row.dueDate.slice(0, 10);
      const existing = map.get(key);
      if (existing) existing.push(row);
      else map.set(key, [row]);
    }
    return map;
  }, [rows]);

  const monthRows = useMemo(() => {
    const prefix = `${year}-${pad(month + 1)}-`;
    return rows
      .filter((r) => r.dueDate.startsWith(prefix))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [rows, year, month]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(year, month, 1));
    const startWeekday = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const list: Array<number | null> = [];
    for (let i = 0; i < startWeekday; i += 1) list.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) list.push(d);
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [year, month]);

  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-KE', {
    month: 'long',
    year: 'numeric',
  });
  const todayKey = dayKey(now.getFullYear(), now.getMonth(), now.getDate());

  const goPrev = () => {
    setMonth((m) => {
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };
  const goNext = () => {
    setMonth((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };
  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={CalendarClock}
        eyebrow="04 — Legal & Documents"
        title="Compliance calendar"
        description="Upcoming obligations, contract renewals, and credential & policy expiries by month."
        footer={<LegalModuleTabs active="calendar" />}
      />

      <DashboardAsyncState
        status={status}
        error={error}
        onRetry={() => void load()}
        loading={<DashboardPageSkeleton variant="detail" />}
      >
        <div className="space-y-4">
          <div className="dashboard-surface flex flex-wrap items-center justify-between gap-3 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous month"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--dash-border)] text-[var(--dash-text-muted)] transition-colors hover:bg-[var(--dash-hover)]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="min-w-[10rem] text-center text-base font-semibold text-[var(--dash-text-strong)]">
                {monthLabel}
              </h2>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next month"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--dash-border)] text-[var(--dash-text-muted)] transition-colors hover:bg-[var(--dash-hover)]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="ml-1 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-xs font-medium text-[var(--dash-text-strong)] transition-colors hover:bg-[var(--dash-hover)]"
              >
                Today
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--dash-text-muted)]">
              {(Object.keys(SOURCE_DOT) as ObligationSource[]).map((src) => (
                <span key={src} className="flex items-center gap-1.5">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${SOURCE_DOT[src]}`} />
                  {SOURCE_LABEL[src]}
                </span>
              ))}
            </div>
          </div>

          <div className="dashboard-surface overflow-hidden p-3 shadow-sm sm:p-4">
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--dash-text-muted)]"
                >
                  {wd}
                </div>
              ))}
              {cells.map((day, idx) => {
                if (day == null) {
                  return <div key={`blank-${idx}`} className="min-h-[92px] rounded-lg" />;
                }
                const key = dayKey(year, month, day);
                const events = eventsByDay.get(key) ?? [];
                const isToday = key === todayKey;
                return (
                  <div
                    key={key}
                    className={`min-h-[92px] rounded-lg border p-1.5 ${
                      isToday
                        ? 'border-[var(--stride-coral)] bg-[color-mix(in_srgb,var(--swatch-coral-bg)_40%,var(--dash-surface-solid))]'
                        : 'border-[var(--dash-border)] bg-[var(--dash-surface-solid)]'
                    }`}
                  >
                    <div
                      className={`mb-1 text-right text-[11px] font-semibold ${
                        isToday ? 'text-[var(--stride-coral)]' : 'text-[var(--dash-text-muted)]'
                      }`}
                    >
                      {day}
                    </div>
                    <div className="space-y-1">
                      {events.slice(0, 3).map((event) => (
                        <Link
                          key={event.id}
                          href={event.href}
                          title={`${event.title} · ${SOURCE_LABEL[event.source]}`}
                          className={`flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            REGISTER_STATUS_BADGE_CLASS[event.status]
                          }`}
                        >
                          <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${SOURCE_DOT[event.source]}`} />
                          <span className="truncate">{event.title}</span>
                        </Link>
                      ))}
                      {events.length > 3 ? (
                        <span className="block px-1.5 text-[10px] text-[var(--dash-text-subtle)]">
                          +{events.length - 3} more
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="dashboard-surface overflow-hidden shadow-sm">
            <div className="border-b border-[var(--dash-border)] px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">Due in {monthLabel}</h3>
              <p className="mt-0.5 text-xs text-[var(--dash-text-muted)]">
                {monthRows.length} item{monthRows.length === 1 ? '' : 's'} scheduled this month.
              </p>
            </div>
            {monthRows.length === 0 ? (
              <DashboardEmptyState
                icon={CalendarClock}
                title="Nothing due this month"
                description="Use the arrows above to browse other months."
              />
            ) : (
              <ul className="divide-y divide-[var(--dash-border)]">
                {monthRows.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={row.href}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--dash-hover)]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${SOURCE_DOT[row.source]}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-[var(--dash-text-strong)]">
                            {row.title}
                          </span>
                          <span className="block truncate text-xs text-[var(--dash-text-muted)]">
                            {SOURCE_LABEL[row.source]} · {row.party}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="hidden tabular-nums text-xs text-[var(--dash-text-muted)] sm:inline">
                          {row.dueDate}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            REGISTER_STATUS_BADGE_CLASS[row.status]
                          }`}
                        >
                          {REGISTER_STATUS_LABEL[row.status]}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DashboardAsyncState>
    </DashboardPage>
  );
}
