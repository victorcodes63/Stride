'use client';

import { useMemo } from 'react';
import { CheckCircle2, RefreshCw, Undo2 } from 'lucide-react';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import {
  DashboardTableActionButton,
  DashboardTableActions,
} from '@/components/dashboard/DashboardDataTable';
import {
  type AttendanceException,
  type AttendanceStatus,
  type AttendanceSummary,
  formatClock,
  formatHours,
} from './types';

function statusTone(status: AttendanceStatus) {
  if (status === 'approved') return dashStatusChip('success');
  if (status === 'reconciled') return dashStatusChip('info');
  return dashStatusChip('neutral');
}

export function StaffAttendanceSummaryTable({
  summaries,
  exceptions,
  canManage,
  busyId,
  onApprove,
  onReopen,
  onReconcile,
}: {
  summaries: AttendanceSummary[];
  exceptions: AttendanceException[];
  canManage: boolean;
  busyId: string | null;
  onApprove: (summary: AttendanceSummary) => void;
  onReopen: (summary: AttendanceSummary) => void;
  onReconcile: (summary: AttendanceSummary) => void;
}) {
  const openByKey = useMemo(() => {
    const map = new Map<string, AttendanceException[]>();
    for (const ex of exceptions) {
      if (ex.status !== 'open') continue;
      const key = `${ex.userId}:${ex.workDate}`;
      const bucket = map.get(key) ?? [];
      bucket.push(ex);
      map.set(key, bucket);
    }
    return map;
  }, [exceptions]);

  return (
    <div className="overflow-x-auto">
      <table className="data-table dashboard-data-table w-full text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Staff</th>
            <th className="px-3 py-2">Department</th>
            <th className="px-3 py-2 col-center">Clock in</th>
            <th className="px-3 py-2 col-center">Clock out</th>
            <th className="px-3 py-2 col-center">Worked</th>
            <th className="px-3 py-2 col-center">Late</th>
            <th className="px-3 py-2 col-center">Overtime</th>
            <th className="px-3 py-2 col-center">Holiday</th>
            <th className="px-3 py-2 col-center">Status</th>
            {canManage ? <th className="px-3 py-2 col-center">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => {
            const rowExceptions = openByKey.get(`${summary.userId}:${summary.workDate}`) ?? [];
            const busy = busyId === summary.id;
            return (
              <tr key={summary.id}>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{summary.workDate}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-[var(--dash-text-strong)]">
                    {summary.user?.name ?? 'Unknown'}
                  </div>
                  <div className="text-xs text-[var(--dash-text-muted)]">{summary.user?.email}</div>
                  {rowExceptions.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {rowExceptions.map((ex) => (
                        <span key={ex.id} className={dashStatusChip('warning')}>
                          {ex.type.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-[var(--dash-text-muted)]">{summary.user?.department ?? '—'}</td>
                <td className="px-3 py-2 col-center tabular-nums">{formatClock(summary.firstInAt)}</td>
                <td className="px-3 py-2 col-center tabular-nums">
                  {summary.lastOutAt ? (
                    formatClock(summary.lastOutAt)
                  ) : (
                    <span className={dashStatusChip('danger')}>Missing</span>
                  )}
                </td>
                <td className="px-3 py-2 col-center tabular-nums">{formatHours(summary.minutesWorked)}</td>
                <td className="px-3 py-2 col-center tabular-nums">
                  {summary.lateMinutes > 0 ? (
                    <span className={dashStatusChip('warning')}>{summary.lateMinutes}m</span>
                  ) : (
                    <span className="text-[var(--dash-text-muted)]">0m</span>
                  )}
                </td>
                <td className="px-3 py-2 col-center">
                  {summary.publicHolidayName ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="tabular-nums">{summary.overtimeMinutes + summary.holidayOvertimeMinutes}m</span>
                      <span className={dashStatusChip('warning')}>Holiday 2x</span>
                    </div>
                  ) : (
                    <span className="tabular-nums">{summary.overtimeMinutes}m</span>
                  )}
                </td>
                <td className="px-3 py-2 col-center">
                  {summary.publicHolidayName ? (
                    <span className={dashStatusChip('info')}>{summary.publicHolidayName}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 col-center">
                  <span className={statusTone(summary.status)}>{summary.status}</span>
                </td>
                {canManage ? (
                  <td className="px-3 py-2 col-center">
                    <DashboardTableActions>
                      {summary.status !== 'approved' ? (
                        <DashboardTableActionButton
                          variant="primary"
                          disabled={busy}
                          onClick={() => onApprove(summary)}
                          title="Approve day"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </DashboardTableActionButton>
                      ) : (
                        <DashboardTableActionButton
                          disabled={busy}
                          onClick={() => onReopen(summary)}
                          title="Reopen day"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Reopen
                        </DashboardTableActionButton>
                      )}
                      <DashboardTableActionButton
                        disabled={busy}
                        onClick={() => onReconcile(summary)}
                        title="Recompute from events"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                      </DashboardTableActionButton>
                    </DashboardTableActions>
                  </td>
                ) : null}
              </tr>
            );
          })}
          {summaries.length === 0 ? (
            <tr>
              <td colSpan={canManage ? 11 : 10} className="px-3 py-10 text-center text-[var(--dash-text-muted)]">
                No attendance summaries match these filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
