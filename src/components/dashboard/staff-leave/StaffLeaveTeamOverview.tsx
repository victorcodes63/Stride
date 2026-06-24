'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { STAFF_USER_TYPE_LABELS } from '@/lib/staff-permissions';
import type { StaffUserType } from '@/types/dashboard';

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

export function StaffLeaveTeamOverview({ data }: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.staff;
    return data.staff.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (STAFF_USER_TYPE_LABELS[s.staffUserType] ?? '').toLowerCase().includes(q),
    );
  }, [data.staff, search]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff by name, email, or role…"
            className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm"
          />
        </div>

        <div className="dashboard-surface overflow-hidden shadow-sm rounded-xl">
          <table className="data-table dashboard-data-table w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="w-8 px-2 py-3" />
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Annual usage</th>
                <th className="px-4 py-3">Last leave</th>
                <th className="px-4 py-3">Pending</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((row) => {
                const isOpen = expanded.has(row.id);
                const pct = usagePct(row.annualUsed, row.annualEntitled);
                return (
                  <Fragment key={row.id}>
                    <tr className="border-t border-neutral-100 hover:bg-neutral-50/50">
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(row.id)}
                          className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
                          aria-expanded={isOpen}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{row.name}</div>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {STAFF_USER_TYPE_LABELS[row.staffUserType] ?? row.staffUserType}
                      </td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-neutral-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary-600"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-neutral-600 whitespace-nowrap">
                            {row.annualUsed}/{row.annualEntitled || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 text-xs">
                        {row.lastLeave
                          ? `${fmtDate(row.lastLeave.startDate)} (${row.lastLeave.totalDays}d)`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {row.pendingCount > 0 ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            {row.pendingCount}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="border-t border-neutral-50 bg-neutral-50/40">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {row.balances.map((b) => (
                              <div
                                key={b.leaveTypeId}
                                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs"
                                style={{ borderLeftWidth: 3, borderLeftColor: b.color || '#043d4a' }}
                              >
                                <div className="font-semibold text-neutral-800">{b.name}</div>
                                <div className="mt-1 grid grid-cols-2 gap-x-2 text-neutral-600">
                                  <span>Used</span>
                                  <span className="text-right tabular-nums">{b.usedDays}</span>
                                  <span>Remaining</span>
                                  <span className="text-right tabular-nums font-medium text-primary-800">
                                    {b.remaining}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
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
    </div>
  );
}
