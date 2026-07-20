'use client';

import { CircleDot, Clock4, LogOut, UserX } from 'lucide-react';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { type LiveBoardCounts, type LiveBoardEntry, formatClock, formatHours } from './types';

const STATE_META: Record<
  LiveBoardEntry['state'],
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  in: { label: 'Clocked in', tone: 'success' },
  completed: { label: 'Completed', tone: 'neutral' },
  missing_check_out: { label: 'No clock-out', tone: 'danger' },
  absent: { label: 'Not in', tone: 'neutral' },
};

function BoardStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock4;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="dashboard-stat-card shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">{label}</span>
        <Icon className={`h-4 w-4 ${tone}`} aria-hidden />
      </div>
      <div className="mt-1 text-2xl font-bold text-[var(--dash-text-strong)]">{value}</div>
    </div>
  );
}

export function StaffAttendanceLiveBoard({
  board,
  counts,
  workDate,
}: {
  board: LiveBoardEntry[];
  counts: LiveBoardCounts;
  workDate: string;
}) {
  const sorted = [...board].sort((a, b) => {
    const order: Record<LiveBoardEntry['state'], number> = {
      in: 0,
      missing_check_out: 1,
      completed: 2,
      absent: 3,
    };
    if (order[a.state] !== order[b.state]) return order[a.state] - order[b.state];
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BoardStat icon={CircleDot} label="Currently in" value={counts.in} tone="text-emerald-600" />
        <BoardStat icon={Clock4} label="Late today" value={counts.late} tone="text-amber-600" />
        <BoardStat icon={LogOut} label="No clock-out" value={counts.missingCheckOut} tone="text-red-600" />
        <BoardStat icon={UserX} label="Not in yet" value={counts.absent} tone="text-neutral-400" />
      </div>

      <div className="dashboard-surface overflow-hidden shadow-sm">
        <div className="border-b border-[var(--dash-border-subtle)] px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">
            Live board · {workDate}
          </h2>
          <p className="text-xs text-[var(--dash-text-muted)]">
            Real-time status for internal staff, computed from today&apos;s events.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table dashboard-data-table w-full text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2 col-center">Clock in</th>
                <th className="px-3 py-2 col-center">Clock out</th>
                <th className="px-3 py-2 col-center">Worked</th>
                <th className="px-3 py-2 col-center">Late</th>
                <th className="px-3 py-2 col-center">State</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => {
                const meta = STATE_META[entry.state];
                return (
                  <tr key={entry.userId}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-[var(--dash-text-strong)]">{entry.name}</div>
                      <div className="text-xs text-[var(--dash-text-muted)]">{entry.email}</div>
                    </td>
                    <td className="px-3 py-2 text-[var(--dash-text-muted)]">{entry.department ?? '—'}</td>
                    <td className="px-3 py-2 col-center tabular-nums">{formatClock(entry.firstInAt)}</td>
                    <td className="px-3 py-2 col-center tabular-nums">{formatClock(entry.lastOutAt)}</td>
                    <td className="px-3 py-2 col-center tabular-nums">{formatHours(entry.minutesWorked)}</td>
                    <td className="px-3 py-2 col-center tabular-nums">
                      {entry.lateMinutes > 0 ? (
                        <span className={dashStatusChip('warning')}>{entry.lateMinutes}m</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 col-center">
                      <span className={dashStatusChip(meta.tone)}>{meta.label}</span>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-[var(--dash-text-muted)]">
                    No active staff found for this organization.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
