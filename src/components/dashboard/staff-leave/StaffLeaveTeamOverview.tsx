'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Loader2, Search } from 'lucide-react';
import { STAFF_USER_TYPE_LABELS } from '@/lib/staff-permissions';
import type { StaffUserType } from '@/types/dashboard';
import { StrideSelect } from '@/components/ui/stride-select';
import { LeavePersonDetail, type LeavePersonDetailData } from '@/components/dashboard/leave/LeavePersonDetail';
import { LeaveExportDialog } from '@/components/dashboard/leave/LeaveExportDialog';

export type TeamOverviewData = {
  year: number;
  kpis: {
    activeStaff: number;
    pendingApprovals: number;
    daysTakenYtd: number;
    onLeaveToday: number;
    lowBalanceCount: number;
  };
  staff: Array<{
    id: string;
    name: string;
    email: string;
    staffUserType: StaffUserType;
    annualEntitled: number;
    annualUsed: number;
    annualRemaining: number;
    ytdTaken?: number;
    pendingCount: number;
    lastLeave: { startDate: string; endDate: string; totalDays: number } | null;
    balances: Array<{
      leaveTypeId: string;
      name: string;
      color: string | null;
      entitledDays: number;
      carriedOver: number;
      usedDays: number;
      remaining: number;
    }>;
  }>;
  upcoming: Array<{
    id: string;
    userName: string;
    leaveType: string;
    color: string | null;
    startDate: string;
    endDate: string;
    totalDays: number;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    at: string;
    actorName: string;
    userName: string;
    leaveType: string;
    totalDays: number;
  }>;
};

type Props = {
  data: TeamOverviewData;
};

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

function activityLabel(action: string): string {
  switch (action) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'submitted':
      return 'submitted';
    case 'cancelled':
      return 'cancelled';
    default:
      return action;
  }
}

type DetailState = LeavePersonDetailData | 'loading' | 'error' | undefined;

export function StaffLeaveTeamOverview({ data }: Props) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [exportOpen, setExportOpen] = useState(false);

  const roleOptions = useMemo(() => {
    const seen = new Set<StaffUserType>();
    for (const s of data.staff) seen.add(s.staffUserType);
    return [
      { value: 'all', label: 'All roles' },
      ...Array.from(seen).map((r) => ({ value: r, label: STAFF_USER_TYPE_LABELS[r] ?? r })),
    ];
  }, [data.staff]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.staff.filter((s) => {
      if (roleFilter !== 'all' && s.staffUserType !== roleFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (STAFF_USER_TYPE_LABELS[s.staffUserType] ?? '').toLowerCase().includes(q)
      );
    });
  }, [data.staff, search, roleFilter]);

  const loadDetail = async (userId: string) => {
    setDetails((prev) => ({ ...prev, [userId]: 'loading' }));
    try {
      const res = await fetch(`/api/staff/leave/person?userId=${encodeURIComponent(userId)}&year=${data.year}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('failed');
      const detail = (await res.json()) as LeavePersonDetailData;
      setDetails((prev) => ({ ...prev, [userId]: detail }));
    } catch {
      setDetails((prev) => ({ ...prev, [userId]: 'error' }));
    }
  };

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

  const usagePct = (used: number, entitled: number) =>
    entitled > 0 ? Math.min(100, Math.round((used / entitled) * 100)) : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Active staff', value: data.kpis.activeStaff },
            { label: 'Pending approvals', value: data.kpis.pendingApprovals },
            { label: 'Days taken YTD', value: data.kpis.daysTakenYtd },
            { label: 'On leave today', value: data.kpis.onLeaveToday },
            { label: 'Low balance', value: data.kpis.lowBalanceCount },
          ].map((kpi) => (
            <div key={kpi.label} className="dashboard-stat-card shadow-sm">
              <div className="text-[10px] uppercase tracking-wide text-neutral-500">{kpi.label}</div>
              <div className="text-2xl font-bold text-primary-900 mt-1 tabular-nums">{kpi.value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff by name, email, or role…"
              className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm"
            />
          </div>
          <StrideSelect
            value={roleFilter}
            onChange={setRoleFilter}
            options={roleOptions}
            ariaLabel="Filter by role"
            className="sm:w-52"
          />
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="btn-primary inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Download className="h-4 w-4" /> Export
          </button>
        </div>

        <div className="dashboard-surface overflow-hidden shadow-sm rounded-xl">
          <table className="data-table dashboard-data-table w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="w-8 px-2 py-3" />
                <th className="px-4 py-3">Staff member</th>
                <th className="px-4 py-3">Annual leave</th>
                <th className="px-4 py-3 text-right">Used</th>
                <th className="px-4 py-3 text-right">Pending</th>
                <th className="px-4 py-3 text-right">YTD taken</th>
                <th className="px-4 py-3">Last leave</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((row) => {
                const isOpen = expanded.has(row.id);
                const pct = usagePct(row.annualUsed, row.annualEntitled);
                const detail = details[row.id];
                return (
                  <Fragment key={row.id}>
                    <tr
                      className="border-t border-neutral-100 hover:bg-neutral-50/50 cursor-pointer"
                      onClick={() => toggleExpanded(row.id)}
                    >
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(row.id);
                          }}
                          className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
                          aria-expanded={isOpen}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{row.name}</div>
                        <div className="text-xs text-neutral-500">{row.email}</div>
                        <div className="text-[11px] text-neutral-400">
                          {STAFF_USER_TYPE_LABELS[row.staffUserType] ?? row.staffUserType}
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[150px]">
                        <div className="font-semibold text-primary-900 tabular-nums">
                          {row.annualRemaining} <span className="text-xs font-normal text-neutral-400">left</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                          <div className="h-full rounded-full bg-primary-600" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{row.annualUsed}</td>
                      <td className="px-4 py-3 text-right">
                        {row.pendingCount > 0 ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            {row.pendingCount}
                          </span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-700">{row.ytdTaken ?? 0}</td>
                      <td className="px-4 py-3 text-neutral-600 text-xs">
                        {row.lastLeave
                          ? `${fmtDate(row.lastLeave.startDate)} · ${row.lastLeave.totalDays}d`
                          : '—'}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="border-t border-neutral-50 bg-neutral-50/40">
                        <td colSpan={7} className="px-4 py-4">
                          {detail === 'loading' || detail === undefined ? (
                            <div className="flex items-center gap-2 py-6 text-sm text-neutral-500">
                              <Loader2 className="h-4 w-4 animate-spin" /> Loading leave detail…
                            </div>
                          ) : detail === 'error' ? (
                            <div className="py-6 text-sm text-red-600">
                              Could not load detail.{' '}
                              <button type="button" onClick={() => void loadDetail(row.id)} className="underline">
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
          </table>
          {filteredStaff.length === 0 ? (
            <p className="p-8 text-center text-sm text-neutral-500">No staff match your search.</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <div className="dashboard-surface rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-secondary-800 mb-3">Upcoming approved leave</h3>
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing scheduled ahead.</p>
          ) : (
            <ul className="space-y-3">
              {data.upcoming.map((u) => (
                <li key={u.id} className="text-sm border-l-2 pl-3" style={{ borderColor: u.color || '#043d4a' }}>
                  <div className="font-medium text-ink">{u.userName}</div>
                  <div className="text-neutral-600">
                    {u.leaveType} · {u.totalDays}d
                  </div>
                  <div className="text-xs text-neutral-500">
                    {fmtDate(u.startDate)} → {fmtDate(u.endDate)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-surface rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-secondary-800 mb-3">Recent activity</h3>
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-neutral-500">No recent leave activity.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="text-sm">
                  <div className="text-ink">
                    <span className="font-medium">{a.userName}</span>{' '}
                    <span className="text-neutral-600">{activityLabel(a.action)}</span>{' '}
                    <span className="text-neutral-700">{a.leaveType}</span>
                    <span className="text-neutral-500"> ({a.totalDays}d)</span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {a.actorName} · {fmtDate(a.at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <LeaveExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        endpoint="/api/staff/leave/export"
        year={data.year}
        groupLabel="Department"
        supportsCostCentre
        people={data.staff.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
