'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Clock4,
  Download,
  Gauge,
  Inbox,
  Loader2,
  MapPin,
  Radio,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import { DashboardAsyncState, DashboardInlineLoading } from '@/components/dashboard/DashboardAsyncState';
import { dashboardFilterInputClass } from '@/components/dashboard/DashboardFilterBar';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import { useDashboardTabParam } from '@/hooks/useDashboardTabParam';
import { StaffAttendanceSummaryTable } from './StaffAttendanceSummaryTable';
import { StaffAttendanceExceptionsInbox } from './StaffAttendanceExceptionsInbox';
import { StaffAttendanceLiveBoard } from './StaffAttendanceLiveBoard';
import { StaffAttendancePoliciesPanel } from './StaffAttendancePoliciesPanel';
import { StaffAttendanceWorkSitesPanel } from './StaffAttendanceWorkSitesPanel';
import {
  type AttendanceException,
  type AttendanceKpis,
  type AttendanceSummary,
  type LiveBoardCounts,
  type LiveBoardEntry,
  type Subject,
} from './types';

const TABS = ['summaries', 'live', 'exceptions', 'policies', 'work-sites'] as const;
type Tab = (typeof TABS)[number];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export function StaffAttendanceClient() {
  const [from, setFrom] = useState(isoDaysAgo(6));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [onlyExceptions, setOnlyExceptions] = useState(false);

  const [summaries, setSummaries] = useState<AttendanceSummary[]>([]);
  const [exceptions, setExceptions] = useState<AttendanceException[]>([]);
  const [kpis, setKpis] = useState<AttendanceKpis>({ presentToday: 0, lateToday: 0, openExceptions: 0, avgHours: 0 });
  const [departments, setDepartments] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [canManage, setCanManage] = useState(false);

  const [board, setBoard] = useState<LiveBoardEntry[]>([]);
  const [boardCounts, setBoardCounts] = useState<LiveBoardCounts>({
    in: 0,
    missingCheckOut: 0,
    late: 0,
    completed: 0,
    absent: 0,
  });
  const [boardWorkDate, setBoardWorkDate] = useState('');
  const [boardLoading, setBoardLoading] = useState(false);

  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exceptionStatus, setExceptionStatus] = useState('open');

  // Manual override form
  const [ovUserId, setOvUserId] = useState('');
  const [ovObservedAt, setOvObservedAt] = useState('');
  const [ovKind, setOvKind] = useState<'check_in' | 'check_out'>('check_in');
  const [ovNotes, setOvNotes] = useState('');
  const [ovSaving, setOvSaving] = useState(false);

  const { tab, setTab } = useDashboardTabParam<Tab>('tab', TABS, 'summaries');

  const loadCore = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (department) params.set('department', department);
        if (status && status !== 'all') params.set('status', status);
        if (search.trim()) params.set('search', search.trim());
        const res = await fetch(`/api/staff/attendance?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load attendance');
        setSummaries(data.summaries ?? []);
        setExceptions(data.exceptions ?? []);
        setKpis(data.kpis ?? kpis);
        setDepartments(data.departments ?? []);
        setCanManage(Boolean(data.canManage));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load attendance data.');
      } finally {
        setInitialLoad(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from, to, department, status, search],
  );

  const loadPass = useRef(0);
  useEffect(() => {
    const silent = loadPass.current > 0;
    loadPass.current += 1;
    void loadCore(silent);
  }, [loadCore]);

  useEffect(() => {
    void fetch('/api/staff/attendance/subjects', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.users)) setSubjects(data.users);
      })
      .catch(() => {});
  }, []);

  const loadBoard = useCallback(async () => {
    setBoardLoading(true);
    try {
      const res = await fetch('/api/staff/attendance/today', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load live board');
      setBoard(data.board ?? []);
      setBoardCounts(data.counts ?? boardCounts);
      setBoardWorkDate(data.workDate ?? '');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load live board');
    } finally {
      setBoardLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === 'live') void loadBoard();
  }, [tab, loadBoard]);

  const visibleSummaries = useMemo(() => {
    if (!onlyExceptions) return summaries;
    const openKeys = new Set(
      exceptions.filter((e) => e.status === 'open').map((e) => `${e.userId}:${e.workDate}`),
    );
    return summaries.filter((s) => openKeys.has(`${s.userId}:${s.workDate}`));
  }, [summaries, exceptions, onlyExceptions]);

  async function summaryAction(summary: AttendanceSummary, action: 'approve' | 'reopen' | 'reconcile') {
    setBusyId(summary.id);
    try {
      const res = await fetch(`/api/staff/attendance/summaries/${summary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      toast.success(
        action === 'approve' ? 'Day approved' : action === 'reopen' ? 'Day reopened' : 'Day reconciled',
      );
      await loadCore(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  async function resolveExceptions(ids: string[], action: 'resolve' | 'ignore', notes: string | null) {
    setBusyId('exceptions');
    try {
      const res = await fetch('/api/staff/attendance/exceptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, resolutionNotes: notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      toast.success(`${data.count ?? ids.length} exception(s) ${action === 'resolve' ? 'resolved' : 'ignored'}`);
      await loadCore(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  async function submitOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!ovUserId || !ovObservedAt) {
      toast.error('Select a staff member and date/time.');
      return;
    }
    setOvSaving(true);
    try {
      const res = await fetch('/api/staff/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ovUserId, observedAt: ovObservedAt, kind: ovKind, notes: ovNotes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save event');
      toast.success('Attendance event saved & reconciled');
      setOvUserId('');
      setOvObservedAt('');
      setOvNotes('');
      await loadCore(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setOvSaving(false);
    }
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (department) params.set('department', department);
    if (status && status !== 'all') params.set('status', status);
    window.open(`/api/staff/attendance/export?${params.toString()}`, '_blank');
  }

  const openExceptionCount = kpis.openExceptions;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Attendance"
        icon={Clock4}
        iconClassName="h-7 w-7 text-primary-600"
        description="Reconciled day summaries, exceptions, live board, and policies for your internal staff."
        actions={
          <button type="button" onClick={exportCsv} className="btn-secondary inline-flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        }
        footer={
          <DashboardTabs
            embedded
            value={tab}
            onChange={setTab}
            items={[
              { value: 'summaries', label: 'Day summaries', icon: CalendarClock },
              { value: 'live', label: 'Live board', icon: Radio },
              {
                value: 'exceptions',
                label: 'Exceptions',
                icon: Inbox,
                badge:
                  openExceptionCount > 0 ? (
                    <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-xs text-white">
                      {openExceptionCount}
                    </span>
                  ) : undefined,
              },
              { value: 'policies', label: 'Policies', icon: ShieldCheck },
              { value: 'work-sites', label: 'Work sites', icon: MapPin },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={UserCheck} label="Present today" value={kpis.presentToday} tone="text-emerald-600" />
        <Kpi icon={Clock4} label="Late today" value={kpis.lateToday} tone="text-amber-600" />
        <Kpi icon={AlertTriangle} label="Open exceptions" value={kpis.openExceptions} tone="text-red-600" />
        <Kpi icon={Gauge} label="Avg hours (range)" value={`${kpis.avgHours}h`} tone="text-primary-600" />
      </div>

      {refreshing ? (
        <p className="flex items-center justify-end gap-1.5 text-xs text-[var(--dash-text-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Updating…
        </p>
      ) : null}

      {tab === 'summaries' ? (
        <div className="space-y-4">
          <div className="dashboard-surface overflow-hidden shadow-sm">
            <div className="border-b border-[var(--dash-border-subtle)] px-4 py-4 sm:px-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--dash-text-muted)]">
                Filters
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className={dashboardFilterInputClass}
                  aria-label="From date"
                />
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={dashboardFilterInputClass}
                  aria-label="To date"
                />
                <StrideSelect
                  value={department}
                  onChange={setDepartment}
                  options={[
                    { value: '', label: 'All departments' },
                    ...departments.map((d) => ({ value: d, label: d })),
                  ]}
                  ariaLabel="Department"
                />
                <StrideSelect
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'all', label: 'All statuses' },
                    { value: 'draft', label: 'Draft' },
                    { value: 'reconciled', label: 'Reconciled' },
                    { value: 'approved', label: 'Approved' },
                  ]}
                  ariaLabel="Status"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search staff name / email"
                  className={dashboardFilterInputClass}
                  aria-label="Search staff"
                />
                <button
                  type="button"
                  onClick={() => setOnlyExceptions((v) => !v)}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm transition-colors ${
                    onlyExceptions
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Open exceptions
                </button>
              </div>
            </div>

            {canManage ? (
              <form
                onSubmit={submitOverride}
                className="border-b border-[var(--dash-border-subtle)] bg-[var(--dash-surface-muted)] px-4 py-4 sm:px-5"
              >
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
                  <Clock4 className="h-4 w-4" />
                  Manual attendance override
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <StrideSelect
                    value={ovUserId}
                    onChange={setOvUserId}
                    options={[
                      { value: '', label: 'Select staff…' },
                      ...subjects.map((s) => ({
                        value: s.id,
                        label: `${s.name}${s.department ? ` · ${s.department}` : ''}`,
                      })),
                    ]}
                    ariaLabel="Staff member"
                  />
                  <input
                    type="datetime-local"
                    value={ovObservedAt}
                    onChange={(e) => setOvObservedAt(e.target.value)}
                    className={dashboardFilterInputClass}
                    aria-label="Observed at"
                  />
                  <StrideSelect
                    value={ovKind}
                    onChange={(value) => setOvKind(value as 'check_in' | 'check_out')}
                    options={[
                      { value: 'check_in', label: 'Check in' },
                      { value: 'check_out', label: 'Check out' },
                    ]}
                    ariaLabel="Event type"
                  />
                  <input
                    type="text"
                    value={ovNotes}
                    onChange={(e) => setOvNotes(e.target.value)}
                    placeholder="Note (optional)"
                    className={dashboardFilterInputClass}
                    aria-label="Note"
                  />
                  <button
                    type="submit"
                    disabled={ovSaving}
                    className="btn-primary inline-flex h-10 items-center justify-center gap-2 text-sm disabled:opacity-60"
                  >
                    {ovSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock4 className="h-4 w-4" />}
                    Save event
                  </button>
                </div>
              </form>
            ) : null}

            <DashboardAsyncState
              status={initialLoad ? 'loading' : error ? 'error' : 'success'}
              error={error}
              onRetry={() => loadCore()}
              loading={<DashboardInlineLoading label="Loading attendance…" />}
            >
              <StaffAttendanceSummaryTable
                summaries={visibleSummaries}
                exceptions={exceptions}
                canManage={canManage}
                busyId={busyId}
                onApprove={(s) => summaryAction(s, 'approve')}
                onReopen={(s) => summaryAction(s, 'reopen')}
                onReconcile={(s) => summaryAction(s, 'reconcile')}
              />
            </DashboardAsyncState>
          </div>
        </div>
      ) : null}

      {tab === 'live' ? (
        boardLoading && board.length === 0 ? (
          <DashboardInlineLoading label="Loading live board…" />
        ) : (
          <StaffAttendanceLiveBoard board={board} counts={boardCounts} workDate={boardWorkDate} />
        )
      ) : null}

      {tab === 'exceptions' ? (
        <ExceptionsTab
          canManage={canManage}
          busy={busyId === 'exceptions'}
          onResolve={resolveExceptions}
          statusFilter={exceptionStatus}
          onStatusFilterChange={setExceptionStatus}
        />
      ) : null}

      {tab === 'policies' ? <StaffAttendancePoliciesPanel subjects={subjects} canManage={canManage} /> : null}

      {tab === 'work-sites' ? <StaffAttendanceWorkSitesPanel /> : null}
    </DashboardPage>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock4;
  label: string;
  value: number | string;
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

/** Exceptions tab fetches its own list so status filter is independent of the summaries range. */
function ExceptionsTab({
  canManage,
  busy,
  onResolve,
  statusFilter,
  onStatusFilterChange,
}: {
  canManage: boolean;
  busy: boolean;
  onResolve: (ids: string[], action: 'resolve' | 'ignore', notes: string | null) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}) {
  const [rows, setRows] = useState<AttendanceException[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/attendance/exceptions?status=${encodeURIComponent(statusFilter)}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) setRows(data.exceptions ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleResolve = useCallback(
    (ids: string[], action: 'resolve' | 'ignore', notes: string | null) => {
      onResolve(ids, action, notes);
      // Optimistically reload after the parent action settles.
      setTimeout(() => void load(), 400);
    },
    [onResolve, load],
  );

  if (loading && rows.length === 0) return <DashboardInlineLoading label="Loading exceptions…" />;

  return (
    <StaffAttendanceExceptionsInbox
      exceptions={rows}
      canManage={canManage}
      statusFilter={statusFilter}
      onStatusFilterChange={onStatusFilterChange}
      busy={busy}
      onResolve={handleResolve}
    />
  );
}
