'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
 AlertTriangle,
 Clock3,
 CalendarDays,
 Check,
 Ban,
 LayoutList,
 LayoutGrid,
 Loader2,
 Plus,
 Settings,
 ShieldPlus,
 Stethoscope,
 Users,
 X,
} from 'lucide-react';
import { DashboardAsyncState, DashboardInlineLoading } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import { useDashboardTabParam } from '@/hooks/useDashboardTabParam';
import {
 StaffLeaveTeamOverview,
 type TeamOverviewData,
} from '@/components/dashboard/staff-leave/StaffLeaveTeamOverview';

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
 reviewNote: string | null;
 createdAt: string;
 leaveType: { name: string; color: string | null };
 user: { name: string; email: string };
 reviewedBy: { name: string } | null;
 approvalSteps?: Array<{
 id: string;
 stepOrder: number;
 status: string;
 actedAt: string | null;
 approver: { id: string; name: string };
 }>;
 approvalActions?: Array<{
 id: string;
 action: string;
 note: string | null;
 createdAt: string;
 actor: { id: string; name: string };
 }>;
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

type StaffLeaveOpsMeta = {
 unit: string;
 role: string;
 criticality: 'routine' | 'essential' | 'critical';
 coveragePlan: string;
 handoverNote: string;
 reliefOfficer: string;
 contactDuringLeave: string;
};

const TAG_OPS_OPEN = '[StaffLeaveOps]';
const TAG_OPS_CLOSE = '[/StaffLeaveOps]';
/** Legacy tag — still parsed for older leave records */
const TAG_LEGACY_OPEN = '[HospitalContext]';
const TAG_LEGACY_CLOSE = '[/HospitalContext]';

const DEFAULT_STAFF_LEAVE_OPS: StaffLeaveOpsMeta = {
 unit: '',
 role: '',
 criticality: 'essential',
 coveragePlan: '',
 handoverNote: '',
 reliefOfficer: '',
 contactDuringLeave: '',
};

function parseStaffLeaveOps(reason?: string | null): { coreReason: string; opsMeta: StaffLeaveOpsMeta | null } {
 if (!reason) return { coreReason: '', opsMeta: null };
 let start = reason.indexOf(TAG_OPS_OPEN);
 let end = reason.indexOf(TAG_OPS_CLOSE);
 let openTag = TAG_OPS_OPEN;
 let closeTag = TAG_OPS_CLOSE;
 if (start === -1 || end === -1) {
 start = reason.indexOf(TAG_LEGACY_OPEN);
 end = reason.indexOf(TAG_LEGACY_CLOSE);
 openTag = TAG_LEGACY_OPEN;
 closeTag = TAG_LEGACY_CLOSE;
 }
 if (start === -1 || end === -1 || end < start) {
 return { coreReason: reason.trim(), opsMeta: null };
 }
 const block = reason.slice(start + openTag.length, end).trim();
 const coreReason = reason.slice(end + closeTag.length).trim();
 const map = new Map<string, string>();
 for (const line of block.split('\n')) {
 const [k, ...rest] = line.split(':');
 if (!k || rest.length === 0) continue;
 map.set(k.trim().toLowerCase(), rest.join(':').trim());
 }
 const criticalityRaw = map.get('criticality');
 const criticality: StaffLeaveOpsMeta['criticality'] =
 criticalityRaw === 'routine' || criticalityRaw === 'critical' ? criticalityRaw : 'essential';
 return {
 coreReason,
 opsMeta: {
 unit: map.get('unit') || '',
 role: map.get('role') || '',
 criticality,
 coveragePlan: map.get('coverage') || '',
 handoverNote: map.get('handover') || '',
 reliefOfficer: map.get('relief officer') || '',
 contactDuringLeave: map.get('contact') || '',
 },
 };
}

function buildStaffLeaveOpsReason(coreReason: string, ctx: StaffLeaveOpsMeta) {
 const block = [
 TAG_OPS_OPEN,
 `Unit: ${ctx.unit || '-'}`,
 `Role: ${ctx.role || '-'}`,
 `Criticality: ${ctx.criticality}`,
 `Coverage: ${ctx.coveragePlan || '-'}`,
 `Handover: ${ctx.handoverNote || '-'}`,
 `Relief Officer: ${ctx.reliefOfficer || '-'}`,
 `Contact: ${ctx.contactDuringLeave || '-'}`,
 TAG_OPS_CLOSE,
 ].join('\n');
 return `${block}\n${coreReason.trim()}`.trim();
}

function daysFromToday(targetIsoDate: string) {
 const t = new Date(targetIsoDate);
 t.setHours(0, 0, 0, 0);
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 return Math.floor((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function computeRisk(app: Application) {
 const { opsMeta } = parseStaffLeaveOps(app.reason);
 let score = 0;
 if (daysFromToday(app.startDate) < 3) score += 2;
 if (app.totalDays >= 7) score += 1;
 if (opsMeta?.criticality === 'critical') score += 2;
 if (opsMeta?.criticality === 'essential') score += 1;
 if (!opsMeta?.coveragePlan || opsMeta.coveragePlan === '-') score += 1;
 if (score >= 4) return { label: 'High risk', style: 'bg-red-100 text-red-800' };
 if (score >= 2) return { label: 'Medium risk', style: 'bg-amber-100 text-amber-900' };
 return { label: 'Low risk', style: 'bg-emerald-100 text-emerald-800' };
}

export default function StaffLeavePage() {
 return (
  <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500">Loading leave…</div>}>
   <StaffLeavePageContent />
  </Suspense>
 );
}

type LeaveTab = 'overview' | 'my' | 'approvals' | 'types';

const LEAVE_TABS = ['overview', 'my', 'approvals', 'types'] as const;

function resolveTabParam(param: string | null): LeaveTab | null {
 if (param === 'overview' || param === 'team-overview') return 'overview';
 if (param === 'approvals' || param === 'team') return 'approvals';
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
 const [submitting, setSubmitting] = useState(false);
 const [form, setForm] = useState({
 leaveTypeId: '',
 startDate: '',
 endDate: '',
 reason: '',
 });
 const [opsMeta, setOpsMeta] = useState<StaffLeaveOpsMeta>(DEFAULT_STAFF_LEAVE_OPS);

 const loadMe = useCallback(async (silent = false) => {
  if (silent) {
   setRefreshing(true);
  }
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
   setError(
    'Could not load leave data. Run npm run db:generate, npx prisma migrate deploy, then npm run db:seed-staff-leave.',
   );
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

 const refresh = () => loadMe().catch(() => {});

 const pendingMine = useMemo(() => applications.filter((a) => a.status === 'pending').length, [applications]);
 const approvedDays = useMemo(
 () => applications.filter((a) => a.status === 'approved').reduce((sum, a) => sum + a.totalDays, 0),
 [applications]
 );
 const totalRemaining = useMemo(() => balances.reduce((sum, b) => sum + b.remaining, 0), [balances]);
 const highRiskApprovals = useMemo(
 () => teamApps.filter((a) => computeRisk(a).label === 'High risk').length,
 [teamApps]
 );

 const submitApplication = async (e: React.FormEvent) => {
 e.preventDefault();
 setSubmitting(true);
 setError(null);
 try {
 const startLeadDays = daysFromToday(form.startDate);
 if (
 opsMeta.criticality === 'critical' &&
 startLeadDays < 7 &&
 !/emergency|urgent|sudden|incident/i.test(form.reason)
 ) {
 throw new Error('Critical-care roles require at least 7 days notice unless emergency leave is stated.');
 }
 if (!opsMeta.coveragePlan.trim()) {
 throw new Error('Coverage plan is required for workplace leave requests.');
 }
 if (!opsMeta.handoverNote.trim()) {
 throw new Error('Handover note is required before submitting leave.');
 }
 const res = await fetch('/api/staff/leave/applications', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 leaveTypeId: form.leaveTypeId,
 startDate: form.startDate,
 endDate: form.endDate,
 reason: buildStaffLeaveOpsReason(form.reason, opsMeta),
 }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed');
 setModal(false);
 setForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
 setOpsMeta(DEFAULT_STAFF_LEAVE_OPS);
 await refresh();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed');
 } finally {
 setSubmitting(false);
 }
 };

 const actOn = async (id: string, action: 'approve' | 'reject' | 'cancel') => {
 const reviewNote =
 action === 'reject' ? window.prompt('Reason (optional)') || undefined : undefined;
 await fetch(`/api/staff/leave/applications/${id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action, reviewNote }),
 }).then(async (r) => {
 if (!r.ok) {
 const d = await r.json();
 alert(d.error || 'Failed');
 return;
 }
 refresh();
 });
 };

 const saveType = async (t: Partial<LeaveType> & { id?: string }) => {
 if (t.id) {
 await fetch(`/api/staff/leave/types/${t.id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(t),
 });
 } else {
 await fetch('/api/staff/leave/types', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(t),
 });
 }
 refresh();
 const tall = await fetch('/api/staff/leave/types?all=1').then((r) => r.json());
 if (Array.isArray(tall)) setTypesAdmin(tall);
 };

 const initBalances = async () => {
 await fetch('/api/staff/leave/balances', { method: 'POST', body: JSON.stringify({ year }) });
 refresh();
 alert('Balances ensured for all users for ' + year);
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Staff leave"
 icon={CalendarDays}
 iconClassName="h-7 w-7 text-primary-600"
 description="Balances, requests, and approvals."
 actions={
 <>
 <select
 value={year}
 onChange={(e) => setYear(parseInt(e.target.value, 10))}
 className="px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white"
 >
 {[year - 1, year, year + 1].map((y) => (
 <option key={y} value={y}>
 {y}
 </option>
 ))}
 </select>
 <button
 type="button"
 onClick={() => setModal(true)}
 className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-semibold hover:bg-primary-800"
 >
 <Plus className="w-4 h-4" />
 Request leave
 </button>
 </>
 }
 footer={
 <DashboardTabs
 embedded
 value={tab}
 onChange={setTab}
 items={[
 {
 value: 'overview',
 label: 'Team overview',
 icon: LayoutGrid,
 hidden: !canApproveLeave,
 },
 {
 value: 'my',
 label: 'My leave',
 icon: LayoutList,
 },
 {
 value: 'approvals',
 label: 'Approvals',
 icon: Users,
 hidden: !canApproveLeave,
 badge:
 teamApps.length > 0 ? (
 <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-xs text-white">{teamApps.length}</span>
 ) : undefined,
 },
 {
 value: 'types',
 label: 'Types & setup',
 icon: Settings,
 hidden: !isAdmin,
 },
 ]}
 />
 }
 />

 {tab === 'my' && !initialLoad ? (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
 <div className="dashboard-stat-card shadow-sm">
 <div className="text-xs uppercase tracking-wide text-neutral-500">Pending requests</div>
 <div className="text-2xl font-bold text-primary-900 mt-1">{pendingMine}</div>
 </div>
 <div className="dashboard-stat-card shadow-sm">
 <div className="text-xs uppercase tracking-wide text-neutral-500">Approved days (year)</div>
 <div className="text-2xl font-bold text-primary-900 mt-1">{approvedDays}</div>
 </div>
 <div className="dashboard-stat-card shadow-sm">
 <div className="text-xs uppercase tracking-wide text-neutral-500">Total remaining</div>
 <div className="text-2xl font-bold text-emerald-700 mt-1">{totalRemaining}</div>
 </div>
 <div className="dashboard-stat-card shadow-sm">
 <div className="text-xs uppercase tracking-wide text-neutral-500">High-risk approvals</div>
 <div className="text-2xl font-bold text-red-700 mt-1">{highRiskApprovals}</div>
 </div>
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
 ) : tab === 'my' ? (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <div className="lg:col-span-1 space-y-3">
 <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Balance {year}</h2>
 {balances.length === 0 ? (
 <p className="text-sm text-neutral-500">No balances — admin: Types → init year.</p>
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
 <span className="tabular-nums text-right">{b.entitledDays + b.carriedOver}</span>
 <span className="text-neutral-500">Used</span>
 <span className="tabular-nums text-right">{b.usedDays}</span>
 <span className="text-neutral-500">Pending</span>
 <span className="tabular-nums text-right">{b.pendingDays}</span>
 <span className="text-neutral-800 font-medium">Available</span>
 <span className="tabular-nums text-right font-semibold text-primary-800">{b.remaining}</span>
 </div>
 </div>
 ))
 )}
 </div>
 <div className="lg:col-span-2">
 <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-3">My requests</h2>
 <div className="dashboard-surface overflow-hidden shadow-sm">
 <table className="data-table dashboard-data-table w-full text-sm">
 <thead className="bg-neutral-50 text-left text-neutral-600">
 <tr>
 <th className="px-4 py-3">Type</th>
 <th className="px-4 py-3">Unit / role</th>
 <th className="px-4 py-3">Dates</th>
 <th className="px-4 py-3">Days</th>
 <th className="px-4 py-3">Status</th>
 <th className="px-4 py-3 w-24"></th>
 </tr>
 </thead>
 <tbody>
 {applications.map((a) => (
 <tr key={a.id} className="border-t border-neutral-100">
 <td className="px-4 py-3 font-medium">{a.leaveType.name}</td>
 <td className="px-4 py-3 text-neutral-600">
 {(() => {
 const parsed = parseStaffLeaveOps(a.reason).opsMeta;
 if (!parsed) return '—';
 return `${parsed.unit || 'N/A'} / ${parsed.role || 'N/A'}`;
 })()}
 </td>
 <td className="px-4 py-3 text-neutral-600">
 {a.startDate.slice(0, 10)} → {a.endDate.slice(0, 10)}
 </td>
 <td className="px-4 py-3 tabular-nums">{a.totalDays}</td>
 <td className="px-4 py-3">
 <StatusPill status={a.status} />
 {a.approvalSteps?.length ? (
 <div className="mt-1 text-[11px] text-neutral-500">
 Step {a.approvalSteps.find((s) => s.status === 'pending')?.stepOrder ?? 'final'} of {a.approvalSteps.length}
 </div>
 ) : null}
 </td>
 <td className="px-4 py-3">
 {a.status === 'pending' && (
 <button
 type="button"
 onClick={() => actOn(a.id, 'cancel')}
 className="text-xs text-red-600 hover:underline"
 >
 Cancel
 </button>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 {applications.length === 0 && (
 <p className="p-8 text-center text-neutral-500 text-sm">No requests yet.</p>
 )}
 </div>
 </div>
 </div>
 ) : tab === 'approvals' && canApproveLeave ? (
 <div className="dashboard-surface shadow-sm overflow-hidden">
 <table className="data-table dashboard-data-table w-full text-sm">
 <thead className="bg-neutral-50 text-left">
 <tr>
 <th className="px-4 py-3">Staff</th>
 <th className="px-4 py-3">Type</th>
 <th className="px-4 py-3">Unit</th>
 <th className="px-4 py-3">Dates</th>
 <th className="px-4 py-3">Days</th>
 <th className="px-4 py-3">Risk</th>
 <th className="px-4 py-3">Reason</th>
 <th className="px-4 py-3">Actions</th>
 </tr>
 </thead>
 <tbody>
 {teamApps.map((a) => (
 <tr key={a.id} className="border-t border-neutral-100">
 <td className="px-4 py-3">
 <div className="font-medium">{a.user.name}</div>
 </td>
 <td className="px-4 py-3">{a.leaveType.name}</td>
 <td className="px-4 py-3 text-neutral-600">
 {parseStaffLeaveOps(a.reason).opsMeta?.unit || '—'}
 </td>
 <td className="px-4 py-3 text-neutral-600">
 {a.startDate.slice(0, 10)} – {a.endDate.slice(0, 10)}
 </td>
 <td className="px-4 py-3">{a.totalDays}</td>
 <td className="px-4 py-3">
 <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${computeRisk(a).style}`}>
 {computeRisk(a).label}
 </span>
 </td>
 <td className="px-4 py-3 max-w-xs truncate" title={parseStaffLeaveOps(a.reason).coreReason || ''}>
 {parseStaffLeaveOps(a.reason).coreReason || '—'}
 </td>
 <td className="px-4 py-3">
 <div className="flex gap-2">
 <button
 type="button"
 onClick={() => actOn(a.id, 'approve')}
 className="p-1.5 rounded-lg bg-green-100 text-green-800 hover:bg-green-200"
 title="Approve"
 >
 <Check className="w-4 h-4" />
 </button>
 <button
 type="button"
 onClick={() => actOn(a.id, 'reject')}
 className="p-1.5 rounded-lg bg-red-100 text-red-800 hover:bg-red-200"
 title="Reject"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 {teamApps.length === 0 && (
 <p className="p-8 text-center text-neutral-500">No pending approvals.</p>
 )}
 </div>
 ) : tab === 'types' && isAdmin ? (
 <div className="space-y-6">
 <div className="flex flex-wrap gap-3 items-center">
 <button
 type="button"
 onClick={initBalances}
 className="px-4 py-2 border border-primary-300 rounded-lg text-sm font-medium text-primary-900 hover:bg-primary-50"
 >
 Ensure balances for all users ({year})
 </button>
 <button
 type="button"
 onClick={() =>
 saveType({
 name: 'New type',
 daysPerYear: 5,
 color: '#64748b',
 sortOrder: 50,
 })
 }
 className="px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm"
 >
 + Add type
 </button>
 </div>
 <div className="dashboard-surface divide-y divide-neutral-100">
 {typesAdmin.map((t) => (
 <div key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
 <div
 className="w-2 h-12 rounded shrink-0"
 style={{ background: t.color || '#ccc' }}
 aria-hidden
 />
 <div className="flex-1 min-w-0 grid sm:grid-cols-4 gap-2 text-sm">
 <input
 defaultValue={t.name}
 onBlur={(e) => e.target.value !== t.name && saveType({ id: t.id, name: e.target.value })}
 className="px-2 py-1 border rounded font-medium"
 />
 <label className="flex items-center gap-1">
 Days/yr
 <input
 type="number"
 defaultValue={t.daysPerYear}
 onBlur={(e) =>
 parseInt(e.target.value, 10) !== t.daysPerYear &&
 saveType({ id: t.id, daysPerYear: parseInt(e.target.value, 10) })
 }
 className="w-16 px-2 py-1 border rounded"
 />
 </label>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 defaultChecked={t.active}
 onChange={(e) => saveType({ id: t.id, active: e.target.checked })}
 />
 Active
 </label>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 defaultChecked={t.requiresApproval}
 onChange={(e) => saveType({ id: t.id, requiresApproval: e.target.checked })}
 />
 Needs approval
 </label>
 </div>
 </div>
 ))}
 </div>
 </div>
 ) : null}
 </DashboardAsyncState>
 </div>

 {modal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setModal(false)}>
 <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 md:p-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
 <h3 className="text-lg font-semibold text-primary-900 mb-4 flex items-center gap-2">
 <Stethoscope className="w-5 h-5 text-primary-700" />
 Request clinical leave
 </h3>
 <form onSubmit={submitApplication} className="space-y-5">
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Type</label>
 <select
 required
 value={form.leaveTypeId}
 onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
 >
 <option value="">Select…</option>
 {types.map((t) => (
 <option key={t.id} value={t.id}>
 {t.name} ({t.daysPerYear} d/yr)
 </option>
 ))}
 </select>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Start</label>
 <input
 type="date"
 required
 value={form.startDate}
 onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">End</label>
 <input
 type="date"
 required
 value={form.endDate}
 onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
 />
 </div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Unit / ward</label>
 <input
 required
 value={opsMeta.unit}
 onChange={(e) => setOpsMeta((ctx) => ({ ...ctx, unit: e.target.value }))}
 placeholder="ICU, Theatre, OPD..."
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Role</label>
 <input
 required
 value={opsMeta.role}
 onChange={(e) => setOpsMeta((ctx) => ({ ...ctx, role: e.target.value }))}
 placeholder="Nurse, MO, Anaesthetist..."
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
 />
 </div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Service criticality</label>
 <select
 value={opsMeta.criticality}
 onChange={(e) =>
 setOpsMeta((ctx) => ({
 ...ctx,
 criticality: e.target.value as StaffLeaveOpsMeta['criticality'],
 }))
 }
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
 >
 <option value="routine">Routine</option>
 <option value="essential">Essential</option>
 <option value="critical">Critical care</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Contact during leave</label>
 <input
 value={opsMeta.contactDuringLeave}
 onChange={(e) => setOpsMeta((ctx) => ({ ...ctx, contactDuringLeave: e.target.value }))}
 placeholder="Phone or alternate contact"
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
 />
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Coverage plan</label>
 <textarea
 required
 value={opsMeta.coveragePlan}
 onChange={(e) => setOpsMeta((ctx) => ({ ...ctx, coveragePlan: e.target.value }))}
 rows={2}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
 placeholder="Who covers shifts/rounds while you are away?"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Handover note</label>
 <textarea
 required
 value={opsMeta.handoverNote}
 onChange={(e) => setOpsMeta((ctx) => ({ ...ctx, handoverNote: e.target.value }))}
 rows={2}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
 placeholder="Pending handover notes, coverage plan, etc."
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Relief officer (optional)</label>
 <input
 value={opsMeta.reliefOfficer}
 onChange={(e) => setOpsMeta((ctx) => ({ ...ctx, reliefOfficer: e.target.value }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
 placeholder="Assigned backup staff"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Reason (optional)</label>
 <textarea
 value={form.reason}
 onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
 rows={3}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
 />
 </div>
 <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex gap-2">
 <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
 For critical-care roles, requests with less than 7 days lead time should be emergency based.
 </div>
 <div className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-900 flex gap-2">
 <ShieldPlus className="w-4 h-4 mt-0.5 shrink-0" />
 Coverage and handover details are attached to your request for approver safety review.
 </div>
 <div className="flex justify-end gap-2 pt-2">
 <button type="button" onClick={() => setModal(false)} className="px-4 py-2 border rounded-lg text-sm">
 Cancel
 </button>
 <button
 type="submit"
 disabled={submitting}
 className="px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-medium disabled:opacity-50"
 >
 {submitting ? 'Submitting…' : 'Submit'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </DashboardPage>
 );
}

function StatusPill({ status }: { status: string }) {
 const map: Record<string, string> = {
 pending: 'bg-amber-100 text-amber-900',
 approved: 'bg-green-100 text-green-900',
 rejected: 'bg-red-100 text-red-900',
 cancelled: 'bg-neutral-100 text-neutral-600',
 };
 return (
 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || ''}`}>
 {status === 'approved' && <Check className="w-3 h-3" />}
 {status === 'rejected' && <Ban className="w-3 h-3" />}
 {status === 'pending' && <Clock3 className="w-3 h-3" />}
 {status}
 </span>
 );
}
