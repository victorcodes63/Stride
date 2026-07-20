'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, LayoutGrid } from 'lucide-react';

export type LeavePersonDetailBalance = {
  leaveTypeId: string;
  name: string;
  color: string | null;
  /** Entitled including carry-over. */
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
};

export type LeavePersonDetailApplication = {
  id: string;
  leaveTypeName: string;
  color: string | null;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
};

export type LeavePersonDetailData = {
  id: string;
  name: string;
  subtitle: string | null;
  meta: string | null;
  year: number;
  annual: { entitled: number; used: number; pending: number; remaining: number };
  balances: LeavePersonDetailBalance[];
  applications: LeavePersonDetailApplication[];
  approvers: string[];
};

const DEFAULT_COLOR = '#043d4a';
const PENDING_COLOR = '#f59e0b';
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type DayMark = { color: string; status: string; label: string };

function eachDate(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const start = new Date(`${startIso.slice(0, 10)}T00:00:00`);
  const end = new Date(`${endIso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return out;
}

function statusPillClass(status: string): string {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-800';
    case 'pending':
    case 'in_progress':
      return 'bg-amber-100 text-amber-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-neutral-100 text-neutral-600';
  }
}

export function LeavePersonDetail({ data }: { data: LeavePersonDetailData }) {
  const [view, setView] = useState<'calendar' | 'balances'>('calendar');

  const dayMarks = useMemo(() => {
    const map = new Map<string, DayMark>();
    // Approved first so pending never overrides an approved fill.
    const ordered = [...data.applications].sort((a, b) =>
      a.status === 'approved' && b.status !== 'approved' ? 1 : -1,
    );
    for (const app of ordered) {
      if (app.status === 'rejected' || app.status === 'cancelled') continue;
      const isPending = app.status === 'pending' || app.status === 'in_progress';
      const color = isPending ? PENDING_COLOR : app.color || DEFAULT_COLOR;
      for (const iso of eachDate(app.startDate, app.endDate)) {
        if (map.has(iso) && !isPending) {
          map.set(iso, { color, status: app.status, label: `${app.leaveTypeName} (${app.status})` });
        } else if (!map.has(iso)) {
          map.set(iso, { color, status: app.status, label: `${app.leaveTypeName} (${app.status})` });
        }
      }
    }
    return map;
  }, [data.applications]);

  const legend = useMemo(() => {
    const seen = new Map<string, string>();
    for (const app of data.applications) {
      if (app.status === 'rejected' || app.status === 'cancelled') continue;
      if (app.status === 'pending' || app.status === 'in_progress') continue;
      if (!seen.has(app.leaveTypeName)) seen.set(app.leaveTypeName, app.color || DEFAULT_COLOR);
    }
    return Array.from(seen.entries());
  }, [data.applications]);

  const hasPending = data.applications.some((a) => a.status === 'pending' || a.status === 'in_progress');
  const datedDays = dayMarks.size;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="dashboard-stat-card shadow-sm w-full sm:w-auto">
          <div className="text-2xl font-bold text-primary-900 tabular-nums">
            {data.annual.remaining} <span className="text-sm font-medium text-neutral-500">annual days left</span>
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            {data.annual.used} used · {data.annual.pending} pending
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setView('calendar')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${
              view === 'calendar' ? 'bg-primary-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <CalendarDays className="h-4 w-4" /> Calendar
          </button>
          <button
            type="button"
            onClick={() => setView('balances')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${
              view === 'balances' ? 'bg-primary-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <LayoutGrid className="h-4 w-4" /> Balances &amp; history
          </button>
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-500">
              <span className="font-semibold text-neutral-700">{datedDays}</span> dated days on calendar in {data.year} · hover a coloured day for details
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {legend.map(([name, color]) => (
                <span key={name} className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                  {name}
                </span>
              ))}
              {hasPending ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full border-2 border-dashed" style={{ borderColor: PENDING_COLOR }} />
                  Pending
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {MONTHS.map((month, m) => (
              <MonthGrid key={month} year={data.year} monthIndex={m} label={month} marks={dayMarks} />
            ))}
          </div>

          {data.approvers.length > 0 ? (
            <p className="pt-1 text-xs text-neutral-500">Approvers: {data.approvers.join(', ')}</p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.balances.map((b) => {
              const allocated = b.entitled > 0 ? Math.min(100, Math.round((b.used / b.entitled) * 100)) : 0;
              const color = b.color || DEFAULT_COLOR;
              return (
                <div key={b.leaveTypeId} className="dashboard-surface rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-800">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      {b.name}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold tabular-nums text-primary-900">{b.remaining}</div>
                      <div className="text-[10px] uppercase tracking-wide text-neutral-400">Available</div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full" style={{ width: `${allocated}%`, backgroundColor: color }} />
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    {b.used} of {b.entitled} days used ({allocated}%)
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Used', value: b.used },
                      { label: 'Pending', value: b.pending },
                      { label: 'Entitled', value: b.entitled },
                    ].map((cell) => (
                      <div key={cell.label} className="rounded-lg bg-neutral-50 py-1.5">
                        <div className="text-sm font-semibold tabular-nums text-neutral-800">{cell.value}</div>
                        <div className="text-[10px] uppercase tracking-wide text-neutral-400">{cell.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="dashboard-surface rounded-xl shadow-sm">
            <div className="border-b border-neutral-100 px-4 py-3">
              <h4 className="text-sm font-semibold text-secondary-800">{data.year} leave history</h4>
              <p className="text-xs text-neutral-500">All requests with dates in this year</p>
            </div>
            {data.applications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-neutral-500">No leave recorded this year.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {data.applications.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.color || DEFAULT_COLOR }} />
                      <div>
                        <div className="text-sm font-medium text-neutral-800">{a.leaveTypeName}</div>
                        <div className="text-xs text-neutral-500">
                          {a.startDate.slice(0, 10)}
                          {a.endDate.slice(0, 10) !== a.startDate.slice(0, 10) ? ` → ${a.endDate.slice(0, 10)}` : ''} · {a.days}d
                        </div>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusPillClass(a.status)}`}>
                      {a.status.replace('_', ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data.approvers.length > 0 ? (
            <p className="text-xs text-neutral-500">Approvers: {data.approvers.join(', ')}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MonthGrid({
  year,
  monthIndex,
  label,
  marks,
}: {
  year: number;
  monthIndex: number;
  label: string;
  marks: Map<string, DayMark>;
}) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  // JS getDay: 0=Sun..6=Sat. Convert to Monday-first offset.
  const firstDow = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-neutral-400">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="py-0.5">{w}</div>
        ))}
      </div>
      <div className="mt-0.5 grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day == null) return <div key={i} className="aspect-square" />;
          const iso = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const mark = marks.get(iso);
          const isPending = mark && (mark.status === 'pending' || mark.status === 'in_progress');
          return (
            <div
              key={i}
              title={mark ? `${iso} · ${mark.label}` : undefined}
              className="flex aspect-square items-center justify-center rounded-full text-[10px] tabular-nums"
              style={
                mark
                  ? isPending
                    ? { border: `1.5px dashed ${mark.color}`, color: mark.color, fontWeight: 600 }
                    : { backgroundColor: mark.color, color: '#fff', fontWeight: 600 }
                  : { color: '#9ca3af' }
              }
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
