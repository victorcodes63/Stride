'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, Plus } from 'lucide-react';
import { useEntity } from '@/components/EntitySwitcher';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTableToolbar } from '@/components/dashboard/DashboardDataTable';
import { dashboardFilterInputClass, dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';
import { AttendanceWorkSitesPanel } from '@/components/dashboard/AttendanceWorkSitesPanel';
import { dashStatusChip } from '@/lib/dashboard-status-chips';

type Client = { id: string; name: string; label?: string };
type Summary = {
 id: string;
 employeeId: string;
 workDate: string;
 firstInAt: string | null;
 lastOutAt: string | null;
 minutesWorked: number;
 lateMinutes: number;
 overtimeMinutes: number;
 holidayOvertimeMinutes?: number;
 publicHolidayName?: string | null;
 status: 'draft' | 'reconciled' | 'approved';
 employee: { firstName: string; lastName: string; employeeNumber: string | null };
};
type Exception = {
 id: string;
 employeeId: string;
 workDate: string;
 type: string;
 status: 'open' | 'resolved' | 'ignored';
 description: string;
 employee: { firstName: string; lastName: string; employeeNumber: string | null };
};

function attendanceStatusClass(label: string) {
 if (label === 'complete') return dashStatusChip('success');
 if (label === 'pending_review') return dashStatusChip('warning');
 return dashStatusChip('neutral');
}

export default function OutsourcingAttendancePage() {
 const { activeEntity } = useEntity();
 const [clients, setClients] = useState<Client[]>([]);
 const [selectedClientId, setSelectedClientId] = useState('');
 const [region, setRegion] = useState<'all' | 'uganda' | 'kenya'>('all');
 const [from, setFrom] = useState(new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
 const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
 const [employeeId, setEmployeeId] = useState('');
 const [observedAt, setObservedAt] = useState('');
 const [kind, setKind] = useState<'check_in' | 'check_out'>('check_in');
 const [summaries, setSummaries] = useState<Summary[]>([]);
 const [exceptions, setExceptions] = useState<Exception[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 async function load() {
 try {
 setLoading(true);
 setError(null);
 const [clientsRes, attendanceRes] = await Promise.all([
 fetch('/api/outsourcing/clients', { cache: 'no-store' }),
 fetch(
 `/api/outsourcing/attendance?clientId=${encodeURIComponent(selectedClientId)}&from=${from}&to=${to}${
 region === 'all'
 ? '&combinedEntities=1'
 : `&region=${encodeURIComponent(region)}`
 }`,
 {
 cache: 'no-store',
 },
 ),
 ]);
 const clientsJson = await clientsRes.json();
 const attendanceJson = await attendanceRes.json();
 if (!clientsRes.ok) throw new Error(clientsJson.error || 'Failed to load clients');
 if (!attendanceRes.ok) throw new Error(attendanceJson.error || 'Failed to load attendance');
 setClients(clientsJson);
 if (Array.isArray(clientsJson) && clientsJson.length === 1 && clientsJson[0]?.id) {
 setSelectedClientId(clientsJson[0].id);
 } else if (!selectedClientId && clientsJson[0]?.id) {
 setSelectedClientId(clientsJson[0].id);
 }
 setSummaries(attendanceJson.summaries ?? []);
 setExceptions(attendanceJson.exceptions ?? []);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to load attendance data');
 } finally {
 setLoading(false);
 }
 }

 useEffect(() => {
 void load();
 }, [selectedClientId, from, to, region, activeEntity.id]);

 const openExceptions = useMemo(() => exceptions.filter((item) => item.status === 'open').length, [exceptions]);
 const exceptionByEmployeeDate = useMemo(() => {
 const map = new Map<string, Exception[]>();
 for (const item of exceptions) {
 const key = `${item.employeeId}:${item.workDate.slice(0, 10)}`;
 const bucket = map.get(key) ?? [];
 bucket.push(item);
 map.set(key, bucket);
 }
 return map;
 }, [exceptions]);

 async function addManualEvent() {
 if (!employeeId || !observedAt) return;
 setError(null);
 const res = await fetch('/api/outsourcing/attendance', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ employeeId, observedAt, kind }),
 });
 const json = await res.json();
 if (!res.ok) {
 setError(json.error || 'Failed to save attendance event.');
 return;
 }
 setEmployeeId('');
 setObservedAt('');
 await load();
 }

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Attendance"
 description="Reconciled day summaries with manual override support."
 />

 {selectedClientId ? (
 <div className="mb-4">
 <AttendanceWorkSitesPanel clientId={selectedClientId} />
 </div>
 ) : null}

 {error ? (
 <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
 {error}
 </div>
 ) : null}

 <div className="overflow-hidden dashboard-surface shadow-sm">
 <DashboardTableToolbar>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
 <select
 value={selectedClientId}
 onChange={(e) => setSelectedClientId(e.target.value)}
 className={dashboardFilterSelectClass}
 aria-label="Workspace client"
 >
 <option value="">Select workspace</option>
 {clients.map((client) => (
 <option key={client.id} value={client.id}>
 {client.label ?? client.name}
 </option>
 ))}
 </select>
 <select
 value={region}
 onChange={(e) => setRegion(e.target.value as 'all' | 'uganda' | 'kenya')}
 className={dashboardFilterSelectClass}
 aria-label="Country / operation"
 >
 <option value="all">All countries (Uganda & Kenya)</option>
 <option value="uganda">Uganda operations (STB-UG…)</option>
 <option value="kenya">Kenya operations (STB-KE…)</option>
 </select>
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
 <div className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm ${dashStatusChip('warning')}`}>
 <AlertTriangle className="h-4 w-4 shrink-0" />
 Open exceptions: {openExceptions}
 </div>
 </div>
 </DashboardTableToolbar>

 <div className="border-t border-[var(--dash-border-subtle)] px-4 py-4 sm:px-5">
 <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
 <Plus className="h-4 w-4" />
 Manual attendance override
 </h2>
 <div className="grid gap-2 sm:grid-cols-4">
 <input
 value={employeeId}
 onChange={(e) => setEmployeeId(e.target.value)}
 placeholder="Employee ID"
 className={dashboardFilterInputClass}
 />
 <input
 type="datetime-local"
 value={observedAt}
 onChange={(e) => setObservedAt(e.target.value)}
 className={dashboardFilterInputClass}
 />
 <select
 value={kind}
 onChange={(e) => setKind(e.target.value as 'check_in' | 'check_out')}
 className={dashboardFilterSelectClass}
 >
 <option value="check_in">Check in</option>
 <option value="check_out">Check out</option>
 </select>
 <button
 type="button"
 onClick={() => void addManualEvent()}
 className="btn-primary inline-flex h-10 items-center justify-center gap-2 text-sm"
 >
 <Clock className="h-4 w-4" />
 Save event
 </button>
 </div>
 </div>

 <div className="overflow-x-auto border-t border-[var(--dash-border-subtle)]">
 <table className="data-table dashboard-data-table w-full text-sm">
 <thead>
 <tr>
 <th className="px-3 py-2">Date</th>
 <th className="px-3 py-2">Employee</th>
 <th className="px-3 py-2 col-center">Clock in</th>
 <th className="px-3 py-2 col-center">Clock out</th>
 <th className="px-3 py-2 col-center">Worked</th>
 <th className="px-3 py-2 col-center">Late</th>
 <th className="px-3 py-2 col-center">Overtime</th>
 <th className="px-3 py-2 col-center">Holiday</th>
 <th className="px-3 py-2 col-center">Status</th>
 </tr>
 </thead>
 <tbody>
 {summaries.map((summary) => (
 <tr key={summary.id}>
 <td className="px-3 py-2 tabular-nums">{summary.workDate.slice(0, 10)}</td>
 <td className="px-3 py-2">
 {summary.employee.employeeNumber ? `${summary.employee.employeeNumber} - ` : ''}
 {summary.employee.firstName} {summary.employee.lastName}
 </td>
 <td className="px-3 py-2 col-center tabular-nums">{summary.firstInAt ? new Date(summary.firstInAt).toLocaleString() : '—'}</td>
 <td className="px-3 py-2 col-center tabular-nums">{summary.lastOutAt ? new Date(summary.lastOutAt).toLocaleString() : 'Missing'}</td>
 <td className="px-3 py-2 col-center tabular-nums">{(summary.minutesWorked / 60).toFixed(2)}h</td>
 <td className="px-3 py-2 col-center tabular-nums">{summary.lateMinutes}m</td>
 <td className="px-3 py-2 col-center">
 {summary.publicHolidayName ? (
 <div className="flex flex-col items-center gap-1">
 <span className="tabular-nums">{summary.overtimeMinutes}m</span>
 <span className={dashStatusChip('warning')}>Holiday 2x</span>
 </div>
 ) : (
 `${summary.overtimeMinutes}m`
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
 {(() => {
 const key = `${summary.employeeId}:${summary.workDate.slice(0, 10)}`;
 const rowExceptions = exceptionByEmployeeDate.get(key) ?? [];
 const missingOut = rowExceptions.some((item) => item.type === 'missing_check_out' && item.status === 'open');
 const label = missingOut ? 'pending_review' : summary.status === 'approved' ? 'corrected' : 'complete';
 return <span className={attendanceStatusClass(label)}>{label}</span>;
 })()}
 </td>
 </tr>
 ))}
 {!loading && summaries.length === 0 ? (
 <tr>
 <td colSpan={9} className="px-3 py-8 text-center text-[var(--dash-text-muted)]">
 No attendance summaries found.
 </td>
 </tr>
 ) : null}
 </tbody>
 </table>
 </div>
 </div>
 </DashboardPage>
 );
}
