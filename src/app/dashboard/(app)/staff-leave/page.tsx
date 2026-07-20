'use client';

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  CalendarOff,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  ListChecks,
  Loader2,
  Plus,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { DashboardAsyncState, DashboardInlineLoading } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { useDashboardTabParam } from '@/hooks/useDashboardTabParam';
import {
  computeLeaveRisk,
  parseStaffLeaveReason,
  LEAVE_PRIORITY_LABELS,
  type StaffLeaveMeta,
} from '@/lib/staff-leave-meta';
import {
  StaffLeaveTeamOverview,
  type TeamOverviewData,
} from '@/components/dashboard/staff-leave/StaffLeaveTeamOverview';
import {
  StaffLeaveApprovalTimeline,
  type ApprovalStep,
  type ApprovalAction,
} from '@/components/dashboard/staff-leave/StaffLeaveApprovalTimeline';
import { StaffLeaveTeamCalendar } from '@/components/dashboard/staff-leave/StaffLeaveTeamCalendar';
import { StaffLeaveLedger } from '@/components/dashboard/staff-leave/StaffLeaveLedger';
import { StaffLeaveRequestModal } from '@/components/dashboard/staff-leave/StaffLeaveRequestModal';

type BalanceRow = {
  id: string;
  leaveTypeId: string;
  name: string;
  color: string | null;
  entitledDays: number;
  usedDays: number;
  carriedOver: number;
  pendingDays: number;
  remaining: number;
};

type Application = {
  id: string;
  userId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: string;
  approvalState?: string;
  currentStepOrder?: number;
  reviewNote: string | null;
  createdAt: string;
  leaveType: { name: string; color: string | null };
  user: { name: string; email: string };
  reviewedBy: { name: string } | null;
  approvalSteps?: ApprovalStep[];
  approvalActions?: ApprovalAction[];
};

type LeaveType = {
  id: string;
  name: string;
  daysPerYear: number;
  color: string | null;
  active: boolean;
  requiresApproval: boolean;
  description: string | null;
  sortOrder: number;
};

function metaSummary(meta: StaffLeaveMeta | null): string {
  if (!meta) return '—';
  const parts = [meta.team, meta.role].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

export default function StaffLeavePage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500">Loading leave…</div>}>
      <StaffLeavePageContent />
    </Suspense>
  );
}

type LeaveTab = 'overview' | 'my' | 'calendar' | 'approvals' | 'types';

const LEAVE_TABS = ['overview', 'my', 'calendar', 'approvals', 'types'] as const;

function resolveTabParam(param: string | null): LeaveTab | null {
  if (param === 'overview' || param === 'team-overview') return 'overview';
  if (param === 'approvals' || param === 'team') return 'approvals';
  if (param === 'calendar') return 'calendar';
  if (param === 'types') return 'types';
  if (param === 'my') return 'my';
  return null;
}

function StaffLeavePageContent() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [teamApps, setTeamApps] = useState<Application[]>([]);
  const [overviewData, setOverviewData] = useState<TeamOverviewData | null>(null);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [typesAdmin, setTypesAdmin] = useState<LeaveType[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canApproveLeave, setCanApproveLeave] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const { tab, setTab } = useDashboardTabParam('tab', LEAVE_TABS, 'my', {
    ready: sessionReady,
    resolveDefault: () => (canApproveLeave ? 'overview' : 'my'),
    parseTab: resolveTabParam,
  });
  const [modal, setModal] = useState(false);
  const [mySubView, setMySubView] = useState<'requests' | 'ledger'>('requests');
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadMe = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    setError(null);
    try {
      const me = await fetch('/api/auth/me').then((r) => r.json());
      const admin = me?.role === 'admin';
      const approver = me?.canApproveStaffLeave === true;
      setIsAdmin(admin);
      setCanApproveLeave(approver);
      setSessionReady(true);

      const y = year;
      const tasks: Promise<void>[] = [
        fetch(`/api/staff/leave/balances?year=${y}`)
          .then((r) => r.json())
          .then((b) => {
            if (b.balances) setBalances(b.balances);
          }),
        fetch('/api/staff/leave/applications?scope=me')
          .then((r) => r.json())
          .then((a) => {
            if (Array.isArray(a)) setApplications(a);
          }),
        fetch('/api/staff/leave/types')
          .then((r) => r.json())
          .then((t) => {
            if (Array.isArray(t)) setTypes(t);
          }),
      ];

      if (approver) {
        tasks.push(
          fetch('/api/staff/leave/applications?scope=team&status=pending')
            .then((r) => r.json())
            .then((team) => {
              if (Array.isArray(team)) setTeamApps(team);
            }),
          fetch(`/api/staff/leave/overview?year=${y}`)
            .then((r) => r.json())
            .then((overview) => {
              if (overview?.staff) setOverviewData(overview as TeamOverviewData);
            }),
        );
      } else {
        setTeamApps([]);
        setOverviewData(null);
      }

      if (admin) {
        tasks.push(
          fetch('/api/staff/leave/types?all=1')
            .then((r) => r.json())
            .then((tall) => {
              if (Array.isArray(tall)) setTypesAdmin(tall);
            }),
        );
      }

      await Promise.all(tasks);
    } catch {
      setError('Could not load leave data. Please try again.');
    } finally {
      setInitialLoad(false);
      setRefreshing(false);
    }
  }, [year]);

  const loadPassRef = useRef(0);
  useEffect(() => {
    const silent = loadPassRef.current > 0;
    loadPassRef.current += 1;
    void loadMe(silent);
  }, [loadMe]);

  const refresh = () => loadMe(true).catch(() => {});

  const pendingMine = useMemo(() => applications.filter((a) => a.status === 'pending').length, [applications]);
  const approvedDays = useMemo(
    () => applications.filter((a) => a.status === 'approved').reduce((sum, a) => sum + a.totalDays, 0),
    [applications],
  );
  const totalRemaining = useMemo(() => balances.reduce((sum, b) => sum + b.remaining, 0), [balances]);
  const highRiskApprovals = useMemo(
    () =>
      teamApps.filter(
        (a) =>
          computeLeaveRisk({
            startDate: a.startDate,
            totalDays: a.totalDays,
            meta: parseStaffLeaveReason(a.reason).meta,
          }).level === 'high',
      ).length,
    [teamApps],
  );

  const actOn = async (app: Application, action: 'approve' | 'reject' | 'cancel') => {
    let reviewNote: string | undefined;
    if (action === 'reject') {
      reviewNote = window.prompt('Reason for rejection (optional)') || undefined;
    }
    setActingId(app.id);
    try {
      const res = await fetch(`/api/staff/leave/applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewNote }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Action failed.');
      if (action === 'cancel') {
        toast.success('Request cancelled.');
      } else if (action === 'reject') {
        toast.success('Request rejected.');
      } else if (data.status === 'approved') {
        toast.success('Request fully approved.');
      } else {
        toast.success('Step approved — advanced to the next approver.');
      }
      await loadMe(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActingId(null);
    }
  };

  const saveType = async (t: Partial<LeaveType> & { id?: string }) => {
    try {
      const res = await fetch(t.id ? `/api/staff/leave/types/${t.id}` : '/api/staff/leave/types', {
        method: t.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save type.');
      toast.success(t.id ? 'Leave type updated.' : 'Leave type added.');
      await loadMe(true);
      const tall = await fetch('/api/staff/leave/types?all=1').then((r) => r.json());
      if (Array.isArray(tall)) setTypesAdmin(tall);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save type.');
    }
  };

  const initBalances = async () => {
    try {
      const res = await fetch('/api/staff/leave/balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not initialise balances.');
      toast.success(`Balances ensured for all staff (${year}).`);
      await loadMe(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not initialise balances.');
    }
  };

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Staff leave"
        icon={CalendarOff}
        iconClassName="h-7 w-7 text-primary-600"
        description="Balances, requests, approvals, and team coverage for internal staff."
        actions={
          <button
            type="button"
            onClick={() => setModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Request leave
          </button>
        }
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <StrideSelect
              value={String(year)}
              onChange={(value) => setYear(parseInt(value, 10))}
              options={[year - 1, year, year + 1].map((y) => ({ value: String(y), label: String(y) }))}
              ariaLabel="Leave year"
              className="w-full sm:w-auto"
            />
            <DashboardTabs
              embedded
              value={tab}
              onChange={setTab}
              items={[
                { value: 'overview', label: 'Team overview', icon: LayoutGrid, hidden: !canApproveLeave },
                { value: 'my', label: 'My leave', icon: LayoutList },
                { value: 'calendar', label: 'Coverage calendar', icon: CalendarRange, hidden: !canApproveLeave },
                {
                  value: 'approvals',
                  label: 'Approvals',
                  icon: Users,
                  hidden: !canApproveLeave,
                  badge:
                    teamApps.length > 0 ? (
                      <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-xs text-white">
                        {teamApps.length}
                      </span>
                    ) : undefined,
                },
                { value: 'types', label: 'Types & setup', icon: Settings, hidden: !isAdmin },
              ]}
            />
          </div>
        }
      />

      {tab === 'my' && !initialLoad ? (
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pending requests" value={pendingMine} />
          <StatCard label="Approved days (year)" value={approvedDays} />
          <StatCard label="Total remaining" value={totalRemaining} accent="text-emerald-700" />
          {canApproveLeave ? (
            <StatCard label="High-risk approvals" value={highRiskApprovals} accent="text-red-700" />
          ) : (
            <StatCard label="Leave types" value={types.length} />
          )}
        </div>
      ) : null}

      <div className="relative min-w-0">
        {refreshing ? (
          <p className="mb-2 flex items-center justify-end gap-1.5 text-xs text-neutral-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Updating…
          </p>
        ) : null}

        <DashboardAsyncState
          status={initialLoad ? 'loading' : error ? 'error' : 'success'}
          error={error}
          onRetry={refresh}
          loading={<DashboardInlineLoading label="Loading leave data…" />}
        >
          {tab === 'overview' && canApproveLeave && overviewData ? (
            <StaffLeaveTeamOverview data={overviewData} />
          ) : tab === 'calendar' && canApproveLeave ? (
            <StaffLeaveTeamCalendar year={year} />
          ) : tab === 'my' ? (
            <MyLeave
              year={year}
              balances={balances}
              applications={applications}
              subView={mySubView}
              onSubView={setMySubView}
              expandedApp={expandedApp}
              onToggleExpand={(id) => setExpandedApp((cur) => (cur === id ? null : id))}
              onCancel={(app) => actOn(app, 'cancel')}
              actingId={actingId}
            />
          ) : tab === 'approvals' && canApproveLeave ? (
            <ApprovalsQueue teamApps={teamApps} onAct={actOn} actingId={actingId} />
          ) : tab === 'types' && isAdmin ? (
            <TypesSetup
              year={year}
              typesAdmin={typesAdmin}
              onSaveType={saveType}
              onInitBalances={initBalances}
            />
          ) : null}
        </DashboardAsyncState>
      </div>

      <StaffLeaveRequestModal
        open={modal}
        onClose={() => setModal(false)}
        types={types.filter((t) => t.active !== false)}
        onSubmitted={refresh}
      />
    </DashboardPage>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="dashboard-stat-card shadow-sm">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent ?? 'text-primary-900'}`}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'approved'
      ? 'success'
      : status === 'rejected'
        ? 'danger'
        : status === 'pending'
          ? 'warning'
          : 'neutral';
  return <span className={`${dashStatusChip(tone)} capitalize`}>{status}</span>;
}

function MyLeave({
  year,
  balances,
  applications,
  subView,
  onSubView,
  expandedApp,
  onToggleExpand,
  onCancel,
  actingId,
}: {
  year: number;
  balances: BalanceRow[];
  applications: Application[];
  subView: 'requests' | 'ledger';
  onSubView: (v: 'requests' | 'ledger') => void;
  expandedApp: string | null;
  onToggleExpand: (id: string) => void;
  onCancel: (app: Application) => void;
  actingId: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-1">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Balance {year}</h2>
        {balances.length === 0 ? (
          <p className="text-sm text-neutral-500">No balances yet — an admin can initialise them under Types &amp; setup.</p>
        ) : (
          balances.map((b) => (
            <div
              key={b.id}
              className="dashboard-stat-card shadow-sm"
              style={{ borderLeftWidth: 4, borderLeftColor: b.color || '#043d4a' }}
            >
              <div className="font-semibold text-neutral-900">{b.name}</div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
                <span className="text-neutral-500">Entitled</span>
                <span className="text-right tabular-nums">{b.entitledDays + b.carriedOver}</span>
                <span className="text-neutral-500">Used</span>
                <span className="text-right tabular-nums">{b.usedDays}</span>
                <span className="text-neutral-500">Pending</span>
                <span className="text-right tabular-nums">{b.pendingDays}</span>
                <span className="font-medium text-neutral-800">Available</span>
                <span className="text-right font-semibold tabular-nums text-primary-800">{b.remaining}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
            {subView === 'requests' ? 'My requests' : 'Balance ledger'}
          </h2>
          <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 text-sm">
            <button
              type="button"
              onClick={() => onSubView('requests')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${
                subView === 'requests' ? 'bg-primary-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <ListChecks className="h-4 w-4" /> Requests
            </button>
            <button
              type="button"
              onClick={() => onSubView('ledger')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${
                subView === 'ledger' ? 'bg-primary-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <CalendarDays className="h-4 w-4" /> Ledger
            </button>
          </div>
        </div>

        {subView === 'ledger' ? (
          <StaffLeaveLedger year={year} />
        ) : (
          <div className="dashboard-surface overflow-hidden shadow-sm">
            <table className="data-table dashboard-data-table w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="w-8 px-2 py-3" />
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Team / role</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-20 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => {
                  const parsed = parseStaffLeaveReason(a.reason);
                  const steps = a.approvalSteps ?? [];
                  const isOpen = expandedApp === a.id;
                  return (
                    <Fragment key={a.id}>
                      <tr className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50/50" onClick={() => onToggleExpand(a.id)}>
                        <td className="px-2 py-3 text-neutral-400">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="px-4 py-3 font-medium">{a.leaveType.name}</td>
                        <td className="px-4 py-3 text-neutral-600">{metaSummary(parsed.meta)}</td>
                        <td className="px-4 py-3 text-neutral-600">
                          {a.startDate.slice(0, 10)} → {a.endDate.slice(0, 10)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{a.totalDays}</td>
                        <td className="px-4 py-3">
                          <StatusPill status={a.status} />
                          {steps.length > 0 && a.status === 'pending' ? (
                            <div className="mt-1 text-[11px] text-neutral-500">
                              Step {a.currentStepOrder ?? 1} of {steps.length}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {a.status === 'pending' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCancel(a);
                              }}
                              disabled={actingId === a.id}
                              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-t border-neutral-50 bg-neutral-50/40">
                          <td colSpan={7} className="px-6 py-4">
                            <RequestDetail parsedReason={parsed} steps={steps} currentStepOrder={a.currentStepOrder} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {applications.length === 0 ? (
              <p className="p-8 text-center text-sm text-neutral-500">No requests yet.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestDetail({
  parsedReason,
  steps,
  currentStepOrder,
}: {
  parsedReason: ReturnType<typeof parseStaffLeaveReason>;
  steps: ApprovalStep[];
  currentStepOrder?: number;
}) {
  const meta = parsedReason.meta;
  const fields: Array<{ label: string; value: string }> = meta
    ? [
        { label: 'Team / department', value: meta.team },
        { label: 'Role', value: meta.role },
        { label: 'Coverage priority', value: LEAVE_PRIORITY_LABELS[meta.priority] },
        { label: 'Backup person', value: meta.backupPerson },
        { label: 'Contact while away', value: meta.contactWhileAway },
        { label: 'Coverage plan', value: meta.coveragePlan },
        { label: 'Handover notes', value: meta.handoverNotes },
      ].filter((f) => f.value)
    : [];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Approval progress</h4>
        <StaffLeaveApprovalTimeline steps={steps} currentStepOrder={currentStepOrder} />
      </div>
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Coverage details</h4>
        {fields.length === 0 && !parsedReason.coreReason ? (
          <p className="text-sm text-neutral-500">No coverage details recorded.</p>
        ) : (
          <dl className="space-y-2 text-sm">
            {fields.map((f) => (
              <div key={f.label}>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-400">{f.label}</dt>
                <dd className="text-neutral-800">{f.value}</dd>
              </div>
            ))}
            {parsedReason.coreReason ? (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-neutral-400">Reason</dt>
                <dd className="text-neutral-800">{parsedReason.coreReason}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </div>
    </div>
  );
}

function ApprovalsQueue({
  teamApps,
  onAct,
  actingId,
}: {
  teamApps: Application[];
  onAct: (app: Application, action: 'approve' | 'reject') => void;
  actingId: string | null;
}) {
  return (
    <div className="dashboard-surface overflow-hidden shadow-sm">
      <table className="data-table dashboard-data-table w-full text-sm">
        <thead className="bg-neutral-50 text-left">
          <tr>
            <th className="px-4 py-3">Staff</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3">Dates</th>
            <th className="px-4 py-3">Days</th>
            <th className="px-4 py-3">Coverage risk</th>
            <th className="px-4 py-3">Step</th>
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {teamApps.map((a) => {
            const parsed = parseStaffLeaveReason(a.reason);
            const risk = computeLeaveRisk({ startDate: a.startDate, totalDays: a.totalDays, meta: parsed.meta });
            const steps = a.approvalSteps ?? [];
            const busy = actingId === a.id;
            return (
              <tr key={a.id} className="border-t border-neutral-100">
                <td className="px-4 py-3">
                  <div className="font-medium">{a.user.name}</div>
                  <div className="text-xs text-neutral-500">{a.user.email}</div>
                </td>
                <td className="px-4 py-3">{a.leaveType.name}</td>
                <td className="px-4 py-3 text-neutral-600">{parsed.meta?.team || '—'}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {a.startDate.slice(0, 10)} – {a.endDate.slice(0, 10)}
                </td>
                <td className="px-4 py-3 tabular-nums">{a.totalDays}</td>
                <td className="px-4 py-3">
                  <span className={dashStatusChip(risk.tone)} title={risk.reasons.join(', ')}>
                    {risk.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {steps.length > 0 ? `${a.currentStepOrder ?? 1} / ${steps.length}` : '—'}
                </td>
                <td className="max-w-xs truncate px-4 py-3" title={parsed.coreReason || ''}>
                  {parsed.coreReason || '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onAct(a, 'approve')}
                      disabled={busy}
                      className="rounded-lg bg-green-100 p-1.5 text-green-800 hover:bg-green-200 disabled:opacity-50"
                      title="Approve"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAct(a, 'reject')}
                      disabled={busy}
                      className="rounded-lg bg-red-100 p-1.5 text-red-800 hover:bg-red-200 disabled:opacity-50"
                      title="Reject"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {teamApps.length === 0 ? (
        <p className="p-8 text-center text-neutral-500">No pending approvals.</p>
      ) : null}
    </div>
  );
}

function TypesSetup({
  year,
  typesAdmin,
  onSaveType,
  onInitBalances,
}: {
  year: number;
  typesAdmin: LeaveType[];
  onSaveType: (t: Partial<LeaveType> & { id?: string }) => void;
  onInitBalances: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onInitBalances}
          className="rounded-lg border border-primary-300 px-4 py-2 text-sm font-medium text-primary-900 hover:bg-primary-50"
        >
          Ensure balances for all staff ({year})
        </button>
        <button
          type="button"
          onClick={() => onSaveType({ name: 'New type', daysPerYear: 5, color: '#64748b', sortOrder: 50 })}
          className="rounded-lg bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700"
        >
          + Add type
        </button>
      </div>
      <div className="dashboard-surface divide-y divide-neutral-100">
        {typesAdmin.map((t) => (
          <div key={t.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="h-12 w-2 shrink-0 rounded" style={{ background: t.color || '#ccc' }} aria-hidden />
            <div className="grid min-w-0 flex-1 gap-2 text-sm sm:grid-cols-4">
              <input
                defaultValue={t.name}
                onBlur={(e) => e.target.value !== t.name && onSaveType({ id: t.id, name: e.target.value })}
                className="rounded border px-2 py-1 font-medium"
              />
              <label className="flex items-center gap-1">
                Days/yr
                <input
                  type="number"
                  defaultValue={t.daysPerYear}
                  onBlur={(e) =>
                    parseInt(e.target.value, 10) !== t.daysPerYear &&
                    onSaveType({ id: t.id, daysPerYear: parseInt(e.target.value, 10) })
                  }
                  className="w-16 rounded border px-2 py-1"
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked={t.active}
                  onChange={(e) => onSaveType({ id: t.id, active: e.target.checked })}
                />
                Active
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked={t.requiresApproval}
                  onChange={(e) => onSaveType({ id: t.id, requiresApproval: e.target.checked })}
                />
                Needs approval
              </label>
            </div>
          </div>
        ))}
        {typesAdmin.length === 0 ? (
          <p className="p-8 text-center text-sm text-neutral-500">No leave types yet — add one above.</p>
        ) : null}
      </div>
    </div>
  );
}
