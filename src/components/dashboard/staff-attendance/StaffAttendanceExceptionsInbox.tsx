'use client';

import { useMemo, useState } from 'react';
import { Ban, CheckCheck, Inbox } from 'lucide-react';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { StrideSelect } from '@/components/ui/stride-select';
import { DashboardEmptyState } from '@/components/dashboard/DashboardAsyncState';
import { type AttendanceException, exceptionTypeLabel } from './types';

function statusTone(status: AttendanceException['status']) {
  if (status === 'resolved') return dashStatusChip('success');
  if (status === 'ignored') return dashStatusChip('neutral');
  return dashStatusChip('warning');
}

export function StaffAttendanceExceptionsInbox({
  exceptions,
  canManage,
  statusFilter,
  onStatusFilterChange,
  busy,
  onResolve,
}: {
  exceptions: AttendanceException[];
  canManage: boolean;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  busy: boolean;
  onResolve: (ids: string[], action: 'resolve' | 'ignore', notes: string | null) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');

  const openIds = useMemo(
    () => exceptions.filter((e) => e.status === 'open').map((e) => e.id),
    [exceptions],
  );
  const allOpenSelected = openIds.length > 0 && openIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allOpenSelected ? new Set() : new Set(openIds));
  }

  function act(action: 'resolve' | 'ignore', ids: string[]) {
    if (ids.length === 0) return;
    onResolve(ids, action, notes.trim() || null);
    setSelected(new Set());
    setNotes('');
  }

  const selectedIds = [...selected];

  return (
    <div className="dashboard-surface overflow-hidden shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--dash-border-subtle)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-[var(--dash-text-muted)]" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Exceptions inbox</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StrideSelect
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={[
              { value: 'open', label: 'Open only' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'ignored', label: 'Ignored' },
              { value: 'all', label: 'All statuses' },
            ]}
            ariaLabel="Exception status filter"
            size="sm"
          />
        </div>
      </div>

      {canManage ? (
        <div className="flex flex-col gap-3 border-b border-[var(--dash-border-subtle)] bg-[var(--dash-surface-muted)] px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Resolution note (optional, applied to actions)"
            className="dash-filter-select h-9 flex-1 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy || selectedIds.length === 0}
              onClick={() => act('resolve', selectedIds)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-900 px-3 text-xs font-medium text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Resolve {selectedIds.length > 0 ? `(${selectedIds.length})` : 'selected'}
            </button>
            <button
              type="button"
              disabled={busy || selectedIds.length === 0}
              onClick={() => act('ignore', selectedIds)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <Ban className="h-3.5 w-3.5" />
              Ignore
            </button>
          </div>
        </div>
      ) : null}

      {exceptions.length === 0 ? (
        <DashboardEmptyState
          icon={Inbox}
          title="No exceptions"
          description="All attendance records are clean for this view."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table dashboard-data-table w-full text-sm">
            <thead>
              <tr>
                {canManage ? (
                  <th className="px-3 py-2 col-center">
                    <input
                      type="checkbox"
                      checked={allOpenSelected}
                      onChange={toggleAll}
                      disabled={openIds.length === 0}
                      aria-label="Select all open exceptions"
                    />
                  </th>
                ) : null}
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 col-center">Status</th>
                <th className="px-3 py-2">Resolved by</th>
                {canManage ? <th className="px-3 py-2 col-center">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {exceptions.map((ex) => (
                <tr key={ex.id}>
                  {canManage ? (
                    <td className="px-3 py-2 col-center">
                      {ex.status === 'open' ? (
                        <input
                          type="checkbox"
                          checked={selected.has(ex.id)}
                          onChange={() => toggle(ex.id)}
                          aria-label={`Select exception ${ex.id}`}
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{ex.workDate}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-[var(--dash-text-strong)]">{ex.user?.name ?? 'Unknown'}</div>
                    <div className="text-xs text-[var(--dash-text-muted)]">{ex.user?.department ?? ''}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={dashStatusChip('info')}>{exceptionTypeLabel(ex.type)}</span>
                  </td>
                  <td className="px-3 py-2 max-w-xs text-[var(--dash-text-muted)]">{ex.description}</td>
                  <td className="px-3 py-2 col-center">
                    <span className={statusTone(ex.status)}>{ex.status}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--dash-text-muted)]">
                    {ex.resolvedByUser ? (
                      <>
                        {ex.resolvedByUser.name}
                        {ex.resolutionNotes ? <div className="italic">“{ex.resolutionNotes}”</div> : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2 col-center">
                      {ex.status === 'open' ? (
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => act('resolve', [ex.id])}
                            className="rounded-lg bg-emerald-100 p-1.5 text-emerald-800 hover:bg-emerald-200 disabled:opacity-50"
                            title="Resolve"
                          >
                            <CheckCheck className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => act('ignore', [ex.id])}
                            className="rounded-lg bg-neutral-100 p-1.5 text-neutral-600 hover:bg-neutral-200 disabled:opacity-50"
                            title="Ignore"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
