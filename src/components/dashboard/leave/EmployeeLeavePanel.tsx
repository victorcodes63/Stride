'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, Check, ChevronDown, ChevronRight, Download, Loader2, X } from 'lucide-react';
import { StrideSelect } from '@/components/ui/stride-select';

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
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';
import { DASHBOARD_STAT_CARD_CLASS } from '@/lib/dashboard-layout';
import { LeavePersonDetail, type LeavePersonDetailData } from '@/components/dashboard/leave/LeavePersonDetail';
import { LeaveExportDialog } from '@/components/dashboard/leave/LeaveExportDialog';

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
const SECTION_TABS = ['queue', 'directory', 'calendar', 'accrual', 'liability'] as const;
type SectionTab = (typeof SECTION_TABS)[number];

type RosterRow = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  annualEntitled: number;
  annualUsed: number;
  annualRemaining: number;
};

type DetailState = LeavePersonDetailData | 'loading' | 'error' | undefined;

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
  const { clientId } = useOutsourcingClient();
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [exportOpen, setExportOpen] = useState(false);

  const loadQueue = useCallback(async () => {
    if (!clientId) {
      setRows([]);
      return;
    }
    const params = new URLSearchParams();
    params.set('clientId', clientId);
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/outsourcing/leave/applications?${params.toString()}`, {
      cache: 'no-store',
    });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.error || 'Failed to load leave applications');
    setRows(Array.isArray(data) ? data : []);
  }, [statusFilter, clientId]);

  const loadOverview = useCallback(async () => {
    if (!clientId) {
      setOverview(null);
      return;
    }
    const res = await fetch(
      `/api/outsourcing/leave/overview?year=${year}&month=${month}&clientId=${encodeURIComponent(clientId)}`,
      { cache: 'no-store' },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load leave overview');
    setOverview(data as EmployeeLeaveOverview);
  }, [year, month, clientId]);

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

  const roster = useMemo<RosterRow[]>(() => {
    if (!overview) return [];
    const byEmployee = new Map<string, RosterRow>();
    for (const row of overview.accrual) {
      let entry = byEmployee.get(row.employeeId);
      if (!entry) {
        entry = {
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          employeeNumber: row.employeeNumber,
          annualEntitled: 0,
          annualUsed: 0,
          annualRemaining: 0,
        };
        byEmployee.set(row.employeeId, entry);
      }
      if (/annual/i.test(row.leaveTypeName)) {
        entry.annualEntitled = row.entitledDays;
        entry.annualUsed = row.usedDays;
        entry.annualRemaining = row.remainingDays;
      }
    }
    return Array.from(byEmployee.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [overview]);

  const loadDetail = useCallback(
    async (employeeId: string) => {
      if (!clientId) return;
      setDetails((prev) => ({ ...prev, [employeeId]: 'loading' }));
      try {
        const res = await fetch(
          `/api/outsourcing/leave/person?employeeId=${encodeURIComponent(employeeId)}&year=${year}&clientId=${encodeURIComponent(clientId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error('failed');
        const detail = (await res.json()) as LeavePersonDetailData;
        setDetails((prev) => ({ ...prev, [employeeId]: detail }));
      } catch {
        setDetails((prev) => ({ ...prev, [employeeId]: 'error' }));
      }
    },
    [clientId, year],
  );

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!details[id] || details[id] === 'error') void loadDetail(id);
      }
      return next;
    });
  };

  async function review(id: string, status: 'approved' | 'rejected') {
    if (!clientId) return;
    setActingId(id);
    try {
      const res = await fetch(
        `/api/outsourcing/leave/applications/${id}?clientId=${encodeURIComponent(clientId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      );
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DashboardTabs
          embedded
          value={section}
          onChange={(v) => setSection(v as SectionTab)}
          items={[
            { value: 'queue', label: 'Approval queue' },
            { value: 'directory', label: 'Employee directory' },
            { value: 'calendar', label: 'Team calendar' },
            { value: 'accrual', label: 'Accrual balances' },
            { value: 'liability', label: 'Liability report' },
          ]}
        />
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          disabled={!clientId}
          className="btn-primary inline-flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      {section !== 'queue' ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-zinc-500">Year</span>
            <StrideSelect
              value={String(year)}
              onChange={(value) => setYear(parseInt(value, 10))}
              options={[year - 1, year, year + 1].map((y) => ({ value: String(y), label: String(y) }))}
              ariaLabel="Year"
              className="mt-1"
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-500">Month</span>
            <StrideSelect
              value={String(month)}
              onChange={(value) => setMonth(parseInt(value, 10))}
              options={Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
                value: String(m),
                label: new Date(2000, m - 1, 1).toLocaleString('en', { month: 'long' }),
              }))}
              ariaLabel="Month"
              className="mt-1"
            />
          </label>
        </div>
      ) : null}

      {overview && section !== 'queue' ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={DASHBOARD_STAT_CARD_CLASS}>
            <div className="text-xs uppercase text-[var(--dash-text-muted)]">Pending requests</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--dash-text-strong)]">{overview.kpis.pendingApplications}</div>
          </div>
          <div className={DASHBOARD_STAT_CARD_CLASS}>
            <div className="text-xs uppercase text-[var(--dash-text-muted)]">Approved this month</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--dash-text-strong)]">{overview.kpis.onLeaveThisMonth}</div>
          </div>
          <div className={DASHBOARD_STAT_CARD_CLASS}>
            <div className="text-xs uppercase text-[var(--dash-text-muted)]">Remaining leave days</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--dash-text-strong)]">{overview.kpis.totalRemainingDays}</div>
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

      {section === 'directory' ? (
        <DashboardTableCard>
          <DashboardAsyncState
            status={loading ? 'loading' : roster.length === 0 ? 'empty' : 'success'}
            error={error}
            onRetry={load}
            loading={<DashboardInlineLoading label="Loading employees…" />}
            empty={
              <DashboardTableEmpty
                icon={<CalendarDays className="h-8 w-8 text-neutral-300" aria-hidden />}
                title="No employees with leave balances"
                description="Employees appear here once leave balances exist for the selected year."
              />
            }
          >
            <DashboardTableViewport>
              <DashboardTable className="text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-600">
                  <tr>
                    <th className="w-8 px-2 py-3" />
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Annual leave</th>
                    <th className="px-4 py-3 text-right">Used</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((row) => {
                    const isOpen = expanded.has(row.employeeId);
                    const pct =
                      row.annualEntitled > 0
                        ? Math.min(100, Math.round((row.annualUsed / row.annualEntitled) * 100))
                        : 0;
                    const detail = details[row.employeeId];
                    return (
                      <Fragment key={row.employeeId}>
                        <tr
                          className="border-t border-neutral-100 hover:bg-neutral-50/50 cursor-pointer"
                          onClick={() => toggleExpanded(row.employeeId)}
                        >
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpanded(row.employeeId);
                              }}
                              className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
                              aria-expanded={isOpen}
                            >
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-neutral-900">{row.employeeName}</div>
                            <div className="text-xs text-neutral-500">{row.employeeNumber ?? '—'}</div>
                          </td>
                          <td className="px-4 py-3 min-w-[150px]">
                            <div className="font-semibold text-primary-900 tabular-nums">
                              {row.annualRemaining}{' '}
                              <span className="text-xs font-normal text-neutral-400">left</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                              <div className="h-full rounded-full bg-primary-600" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{row.annualUsed}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{row.annualRemaining}</td>
                        </tr>
                        {isOpen ? (
                          <tr className="border-t border-neutral-50 bg-neutral-50/40">
                            <td colSpan={5} className="px-4 py-4">
                              {detail === 'loading' || detail === undefined ? (
                                <div className="flex items-center gap-2 py-6 text-sm text-neutral-500">
                                  <Loader2 className="h-4 w-4 animate-spin" /> Loading leave detail…
                                </div>
                              ) : detail === 'error' ? (
                                <div className="py-6 text-sm text-red-600">
                                  Could not load detail.{' '}
                                  <button
                                    type="button"
                                    onClick={() => void loadDetail(row.employeeId)}
                                    className="underline"
                                  >
                                    Retry
                                  </button>
                                </div>
                              ) : (
                                <LeavePersonDetail data={detail} />
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </DashboardTable>
            </DashboardTableViewport>
          </DashboardAsyncState>
        </DashboardTableCard>
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

      <LeaveExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        endpoint="/api/outsourcing/leave/export"
        year={year}
        groupLabel="Department"
        supportsCostCentre
        people={roster.map((r) => ({ id: r.employeeId, name: r.employeeName }))}
        extraParams={clientId ? { clientId } : undefined}
      />
    </div>
  );
}
