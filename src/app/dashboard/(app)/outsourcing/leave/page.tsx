'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, Check, X } from 'lucide-react';
import { DashboardAsyncState, DashboardInlineLoading } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';

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

const STATUS_TABS = ['', 'pending', 'approved', 'rejected'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

function statusBadge(status: string) {
  if (status === 'pending') return 'bg-amber-100 text-amber-900';
  if (status === 'approved') return 'bg-emerald-100 text-emerald-900';
  if (status === 'rejected') return 'bg-red-100 text-red-900';
  return 'bg-neutral-100 text-neutral-700';
}

function statusTabLabel(value: StatusTab) {
  if (value === '') return 'All';
  if (value === 'pending') return 'Pending';
  if (value === 'approved') return 'Approved';
  return 'Rejected';
}

export default function OutsourcingLeavePage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500">Loading leave…</div>}>
      <OutsourcingLeaveContent />
    </Suspense>
  );
}

function OutsourcingLeaveContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || 'pending';
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/outsourcing/leave/applications?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data.error || 'Failed to load leave applications');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leave applications');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const fromUrl = searchParams.get('status');
    if (fromUrl && fromUrl !== statusFilter) setStatusFilter(fromUrl);
  }, [searchParams, statusFilter]);

  const pendingCount = useMemo(() => rows.filter((r) => r.status === 'pending').length, [rows]);

  const listStatus = useMemo(() => {
    if (loading) return 'loading' as const;
    if (error && rows.length === 0) return 'error' as const;
    if (rows.length === 0) return 'empty' as const;
    return 'success' as const;
  }, [error, loading, rows.length]);

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
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  }

  const activeTab = (STATUS_TABS.includes(statusFilter as StatusTab) ? statusFilter : '') as StatusTab;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Workforce leave"
        description="Review and action leave requests in the active company context."
        footer={
          <DashboardTabs
            embedded
            value={activeTab}
            onChange={(next) => setStatusFilter(next)}
            items={STATUS_TABS.map((value) => ({
              value,
              label: statusTabLabel(value),
              badge:
                value === 'pending' && statusFilter === 'pending' && pendingCount > 0 ? (
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
                    {pendingCount}
                  </span>
                ) : undefined,
            }))}
          />
        }
      />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <DashboardTableCard>
        <DashboardAsyncState
          status={listStatus}
          error={rows.length === 0 ? error : null}
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
                    <td className="px-4 py-3 tabular-nums">
                      {row.startDate} → {row.endDate}
                    </td>
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
                            onClick={() => review(row.id, 'approved')}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={actingId === row.id}
                            onClick={() => review(row.id, 'rejected')}
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
    </DashboardPage>
  );
}
