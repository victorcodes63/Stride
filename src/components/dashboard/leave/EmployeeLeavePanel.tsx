'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, Check, X } from 'lucide-react';

import { DashboardAsyncState, DashboardInlineLoading } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import type { EmployeeLeaveOverview } from '@/lib/leave/employee-overview';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import useEntityConfig, { useCurrencyFormatter } from '@/hooks/useEntityConfig';

type LeaveRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  departmentName: string | null;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason: string | null;
};

const QUEUE_TABS = ['', 'pending', 'approved', 'rejected'] as const;
type QueueTab = (typeof QUEUE_TABS)[number];
const SECTION_TABS = ['queue', 'calendar', 'accrual', 'liability'] as const;
type SectionTab = (typeof SECTION_TABS)[number];

function statusBadge(status: string) {
  if (status === 'pending') return dashStatusChip('warning');
  if (status === 'approved') return dashStatusChip('success');
  if (status === 'rejected') return dashStatusChip('danger');
  return dashStatusChip('neutral');
}

function queueTabLabel(value: QueueTab) {
  if (value === '') return 'All';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function EmployeeLeavePanel() {
  const searchParams = useSearchParams();
  const formatCurrency = useCurrencyFormatter();
  useEntityConfig();

  const initialSection = (searchParams.get('section') as SectionTab) || 'queue';
  const [section, setSection] = useState<SectionTab>(
    SECTION_TABS.includes(initialSection) ? initialSection : 'queue',
  );
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'pending');
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [overview, setOverview] = useState<EmployeeLeaveOverview | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/outsourcing/leave/applications?${params.toString()}`, {
      cache: 'no-store',
    });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.error || 'Failed to load leave applications');
    setRows(Array.isArray(data) ? data : []);
  }, [statusFilter]);

  const loadOverview = useCallback(async () => {
    const res = await fetch(
      `/api/outsourcing/leave/overview?year=${year}&month=${month}`,
      { cache: 'no-store' },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load leave overview');
    setOverview(data as EmployeeLeaveOverview);
  }, [year, month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (section === 'queue') {
        await loadQueue();
      } else {
        await loadOverview();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [section, loadQueue, loadOverview]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(() => rows.filter((r) => r.status === 'pending').length, [rows]);

  async function review(id: string, status: 'approved' | 'rejected') {
    setActingId(id);
    try {
      const res = await fetch(`/api/outsourcing/leave/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Action failed');
      await loadQueue();
      if (section !== 'queue') await loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  }

  const activeQueueTab = (QUEUE_TABS.includes(statusFilter as QueueTab) ? statusFilter : '') as QueueTab;

  return (
    <div className="space-y-4">
      <DashboardTabs
        embedded
        value={section}
        onChange={(v) => setSection(v as SectionTab)}
        items={[
          { value: 'queue', label: 'Approval queue' },
          { value: 'calendar', label: 'Team calendar' },
          { value: 'accrual', label: 'Accrual balances' },
          { value: 'liability', label: 'Liability report' },
        ]}
      />

      {section !== 'queue' ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-zinc-500">Year</span>
            <select
              className="mt-1 block rounded-lg border border-zinc-200 px-3 py-2"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
            >
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-500">Month</span>
            <select
              className="mt-1 block rounded-lg border border-zinc-200 px-3 py-2"
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString('en', { month: 'long' })}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {overview && section !== 'queue' ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase text-zinc-500">Pending requests</div>
            <div className="mt-1 text-2xl font-semibold">{overview.kpis.pendingApplications}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase text-zinc-500">Approved this month</div>
            <div className="mt-1 text-2xl font-semibold">{overview.kpis.onLeaveThisMonth}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase text-zinc-500">Remaining leave days</div>
            <div className="mt-1 text-2xl font-semibold">{overview.kpis.totalRemainingDays}</div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {section === 'queue' ? (
        <>
          <DashboardTabs
            embedded
            value={activeQueueTab}
            onChange={(next) => setStatusFilter(next)}
            items={QUEUE_TABS.map((value) => ({
              value,
              label: queueTabLabel(value),
              badge:
                value === 'pending' && statusFilter === 'pending' && pendingCount > 0 ? (
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
                    {pendingCount}
                  </span>
                ) : undefined,
            }))}
          />
          <DashboardTableCard>
            <DashboardAsyncState
              status={loading ? 'loading' : rows.length === 0 ? 'empty' : 'success'}
              error={error}
              onRetry={load}
              loading={<DashboardInlineLoading label="Loading leave requests…" />}
              empty={
                <DashboardTableEmpty
                  icon={<CalendarDays className="h-8 w-8 text-neutral-300" aria-hidden />}
                  title="No leave requests"
                  description="No leave requests match this filter."
                />
              }
            >
              <DashboardTableViewport>
                <DashboardTable className="text-sm">
                  <thead className="bg-neutral-50 text-left text-neutral-600">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Dates</th>
                      <th className="px-4 py-3">Days</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-neutral-100">
                        <td className="px-4 py-3">
                          <div className="font-medium text-neutral-900">{row.employeeName}</div>
                          <div className="text-xs text-neutral-500">{row.employeeNumber ?? '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-neutral-600">{row.departmentName ?? '—'}</td>
                        <td className="px-4 py-3">{row.leaveTypeName}</td>
                        <td className="px-4 py-3 tabular-nums">{row.startDate} → {row.endDate}</td>
                        <td className="px-4 py-3 tabular-nums">{row.days}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadge(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.status === 'pending' ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={actingId === row.id}
                                onClick={() => void review(row.id, 'approved')}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={actingId === row.id}
                                onClick={() => void review(row.id, 'rejected')}
                                className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                              >
                                <X className="h-3.5 w-3.5" />
                                Decline
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
              </DashboardTableViewport>
            </DashboardAsyncState>
          </DashboardTableCard>
        </>
      ) : null}

      {section === 'calendar' && overview ? (
        <DashboardTableCard>
          {loading ? (
            <DashboardInlineLoading label="Loading calendar…" />
          ) : overview.calendar.length === 0 ? (
            <DashboardTableEmpty title="No leave this month" description="Approved and pending leave overlapping this month will appear here." />
          ) : (
            <DashboardTableViewport>
              <DashboardTable className="text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-600">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Days</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.calendar.map((event) => (
                    <tr key={event.id} className="border-t border-neutral-100">
                      <td className="px-4 py-3 font-medium">{event.employeeName}</td>
                      <td className="px-4 py-3">{event.leaveTypeName}</td>
                      <td className="px-4 py-3 tabular-nums">{event.startDate} → {event.endDate}</td>
                      <td className="px-4 py-3 tabular-nums">{event.days}</td>
                      <td className="px-4 py-3 capitalize">{event.status}</td>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            </DashboardTableViewport>
          )}
        </DashboardTableCard>
      ) : null}

      {section === 'accrual' && overview ? (
        <DashboardTableCard>
          {loading ? (
            <DashboardInlineLoading label="Loading accrual balances…" />
          ) : (
            <DashboardTableViewport>
              <DashboardTable className="text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-600">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Leave type</th>
                    <th className="px-4 py-3">Entitled</th>
                    <th className="px-4 py-3">Used</th>
                    <th className="px-4 py-3">Remaining</th>
                    <th className="px-4 py-3">Accrual</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.accrual.map((row, i) => (
                    <tr key={`${row.employeeId}-${row.leaveTypeName}-${i}`} className="border-t border-neutral-100">
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.employeeName}</div>
                        <div className="text-xs text-neutral-500">{row.employeeNumber ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3">{row.leaveTypeName}</td>
                      <td className="px-4 py-3 tabular-nums">{row.entitledDays}</td>
                      <td className="px-4 py-3 tabular-nums">{row.usedDays}</td>
                      <td className="px-4 py-3 tabular-nums">{row.remainingDays}</td>
                      <td className="px-4 py-3 text-xs text-neutral-600">{row.accrualMode.replace(/_/g, ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            </DashboardTableViewport>
          )}
        </DashboardTableCard>
      ) : null}

      {section === 'liability' && overview ? (
        <DashboardTableCard>
          <div className="border-b border-neutral-100 px-4 py-3 text-sm text-neutral-600">
            Estimated leave liability (remaining days × daily rate from base salary):{' '}
            <span className="font-semibold text-neutral-900">
              {formatCurrency(overview.liability.totalAmount, overview.liability.currency)}
            </span>
          </div>
          {loading ? (
            <DashboardInlineLoading label="Loading liability report…" />
          ) : (
            <DashboardTableViewport>
              <DashboardTable className="text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-600">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Leave type</th>
                    <th className="px-4 py-3">Days left</th>
                    <th className="px-4 py-3">Daily rate</th>
                    <th className="px-4 py-3">Liability</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.liability.rows.map((row, i) => (
                    <tr key={`${row.employeeId}-${i}`} className="border-t border-neutral-100">
                      <td className="px-4 py-3 font-medium">{row.employeeName}</td>
                      <td className="px-4 py-3">{row.leaveTypeName}</td>
                      <td className="px-4 py-3 tabular-nums">{row.remainingDays}</td>
                      <td className="px-4 py-3 tabular-nums">{formatCurrency(row.dailyRate, overview.liability.currency)}</td>
                      <td className="px-4 py-3 tabular-nums font-medium">{formatCurrency(row.liabilityAmount, overview.liability.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            </DashboardTableViewport>
          )}
        </DashboardTableCard>
      ) : null}
    </div>
  );
}
