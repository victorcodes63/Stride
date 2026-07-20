'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toast';

type CalendarEntry = {
  id: string;
  userId: string;
  userName: string;
  department: string;
  leaveTypeName: string;
  color: string | null;
  startDate: string;
  endDate: string;
  status: string;
  totalDays: number;
};

type CalendarMember = { id: string; name: string; email: string; department: string };

type CalendarData = { year: number; month: number; members: CalendarMember[]; entries: CalendarEntry[] };

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DEFAULT_COLOR = '#043d4a';
const PENDING_COLOR = '#f59e0b';

function dayNumbersInRange(startIso: string, endIso: string, year: number, month: number): number[] {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  const from = start < monthStart ? monthStart : start;
  const to = end > monthEnd ? monthEnd : end;
  const days: number[] = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    days.push(d.getDate());
  }
  return days;
}

export function StaffLeaveTeamCalendar({ year: initialYear }: { year: number }) {
  const today = new Date();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setYear(initialYear);
  }, [initialYear]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/leave/calendar?year=${year}&month=${month}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('failed');
      setData((await res.json()) as CalendarData);
    } catch {
      toast.error('Could not load the team calendar.');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const dayList = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const isWeekend = (day: number) => {
    const dow = new Date(year, month - 1, day).getDay();
    return dow === 0 || dow === 6;
  };

  // group entries per user + day
  const marksByUser = useMemo(() => {
    const map = new Map<string, Map<number, { color: string; pending: boolean; label: string }>>();
    if (!data) return map;
    for (const entry of data.entries) {
      const isPending = entry.status === 'pending' || entry.status === 'in_progress';
      const color = isPending ? PENDING_COLOR : entry.color || DEFAULT_COLOR;
      const days = dayNumbersInRange(entry.startDate, entry.endDate, data.year, data.month);
      const userMap = map.get(entry.userId) ?? new Map();
      for (const day of days) {
        const existing = userMap.get(day);
        if (!existing || (existing.pending && !isPending)) {
          userMap.set(day, { color, pending: isPending, label: `${entry.leaveTypeName} (${entry.status})` });
        }
      }
      map.set(entry.userId, userMap);
    }
    return map;
  }, [data]);

  // conflicts: >=2 people of the same department off on the same day
  const conflictDaysByDept = useMemo(() => {
    const map = new Map<string, Set<number>>();
    if (!data) return map;
    const counts = new Map<string, Map<number, number>>();
    for (const entry of data.entries) {
      const dept = entry.department || 'Unassigned';
      const days = dayNumbersInRange(entry.startDate, entry.endDate, data.year, data.month);
      const deptCounts = counts.get(dept) ?? new Map<number, number>();
      for (const day of days) deptCounts.set(day, (deptCounts.get(day) ?? 0) + 1);
      counts.set(dept, deptCounts);
    }
    for (const [dept, deptCounts] of counts) {
      const set = new Set<number>();
      for (const [day, count] of deptCounts) if (count >= 2) set.add(day);
      if (set.size > 0) map.set(dept, set);
    }
    return map;
  }, [data]);

  const grouped = useMemo(() => {
    const byDept = new Map<string, CalendarMember[]>();
    if (!data) return [] as Array<[string, CalendarMember[]]>;
    // only include members who have at least one entry this month
    const activeUserIds = new Set(data.entries.map((e) => e.userId));
    for (const m of data.members) {
      if (!activeUserIds.has(m.id)) continue;
      const dept = m.department || 'Unassigned';
      const list = byDept.get(dept) ?? [];
      list.push(m);
      byDept.set(dept, list);
    }
    return Array.from(byDept.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  const totalConflicts = useMemo(() => {
    let n = 0;
    for (const set of conflictDaysByDept.values()) n += set.size;
    return n;
  }, [conflictDaysByDept]);

  const step = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            className="rounded-lg border border-neutral-200 p-2 text-neutral-600 hover:bg-neutral-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[9rem] text-center text-sm font-semibold text-primary-900">
            {MONTHS[month - 1]} {year}
          </div>
          <button
            type="button"
            onClick={() => step(1)}
            className="rounded-lg border border-neutral-200 p-2 text-neutral-600 hover:bg-neutral-50"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: DEFAULT_COLOR }} /> Approved
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-dashed" style={{ borderColor: PENDING_COLOR }} /> Pending
          </span>
          {totalConflicts > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" /> {totalConflicts} department overlap{totalConflicts === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading calendar…
        </div>
      ) : grouped.length === 0 ? (
        <p className="dashboard-surface rounded-xl p-10 text-center text-sm text-neutral-500 shadow-sm">
          Nobody is scheduled off in {MONTHS[month - 1]} {year}.
        </p>
      ) : (
        <div className="dashboard-surface overflow-x-auto rounded-xl shadow-sm">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50">
                <th className="sticky left-0 z-10 min-w-[180px] bg-neutral-50 px-3 py-2 text-left font-semibold text-neutral-600">
                  Staff member
                </th>
                {dayList.map((day) => (
                  <th
                    key={day}
                    className={`w-7 px-0 py-2 text-center font-medium ${
                      isWeekend(day) ? 'bg-neutral-100 text-neutral-400' : 'text-neutral-500'
                    }`}
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map(([dept, members]) => {
                const conflicts = conflictDaysByDept.get(dept) ?? new Set<number>();
                return (
                  <Fragment key={dept}>
                    <tr>
                      <td
                        colSpan={dayList.length + 1}
                        className="sticky left-0 bg-primary-50/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-800"
                      >
                        {dept}
                        {conflicts.size > 0 ? (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                            <AlertTriangle className="h-3 w-3" /> {conflicts.size} overlap day{conflicts.size === 1 ? '' : 's'}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                    {members.map((m) => {
                      const marks = marksByUser.get(m.id) ?? new Map();
                      return (
                        <tr key={m.id} className="border-t border-neutral-100">
                          <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
                            <div className="truncate font-medium text-neutral-800">{m.name}</div>
                          </td>
                          {dayList.map((day) => {
                            const mark = marks.get(day);
                            const weekend = isWeekend(day);
                            const conflict = mark && conflicts.has(day);
                            return (
                              <td
                                key={day}
                                className={`h-7 p-0.5 text-center ${weekend ? 'bg-neutral-50' : ''}`}
                                title={mark ? `${m.name} · ${day} ${MONTHS[month - 1]} · ${mark.label}` : undefined}
                              >
                                {mark ? (
                                  <span
                                    className="mx-auto block h-4 w-4 rounded"
                                    style={
                                      mark.pending
                                        ? { border: `1.5px dashed ${mark.color}` }
                                        : {
                                            backgroundColor: mark.color,
                                            boxShadow: conflict ? '0 0 0 2px #dc2626' : undefined,
                                          }
                                    }
                                  />
                                ) : null}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
