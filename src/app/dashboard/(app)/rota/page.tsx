'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEntity } from '@/components/EntitySwitcher';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
 LayoutGrid,
 FileSpreadsheet,
 AlertTriangle,
 Clock,
 CalendarRange,
 RefreshCw,
 Plus,
 Upload,
 Pencil,
 Copy,
 ChevronLeft,
 ChevronRight,
} from 'lucide-react';

type OutsourcingClient = { id: string; name: string };
type Employee = {
 id: string;
 firstName: string;
 lastName: string;
 employeeNumber: string | null;
};
type ShiftTemplate = {
 id: string;
 name: string;
 startMinutes: number;
 endMinutes: number;
 breakMinutes: number;
 color: string | null;
 isActive: boolean;
};
type RotaPeriod = {
 id: string;
 name: string | null;
 startDate: string;
 endDate: string;
 status: 'draft' | 'published';
};
type Assignment = {
 id: string;
 employeeId: string;
 workDate: string;
 startsAt: string;
 endsAt: string;
 breakMinutes: number;
 notes: string | null;
 employee?: { firstName: string; lastName: string; employeeNumber: string | null };
 shiftTemplate?: { id?: string; name: string | null; color?: string | null };
};

type AssignmentDraft = {
 employeeId: string;
 workDate: string;
 shiftTemplateId: string;
 startTime: string;
 endTime: string;
 breakMinutes: number;
 notes: string;
 useTemplate: boolean;
};
type Conflict = {
 type: 'insufficient_rest' | 'weekly_hours_cap';
 employeeId: string;
 message: string;
 assignmentIds: string[];
};

type OperationResult = {
 title: string;
 created?: number;
 updated?: number;
 deleted?: number;
 skipped?: number;
 conflicts?: number;
 message?: string;
};

type BulkFailure = {
 id: string;
 source: 'bulk-template' | 'copy-week' | 'csv';
 employeeId: string;
 workDate: string;
 reason: string;
 payload:
 | { shiftTemplateId: string }
 | { startsAt: string; endsAt: string; breakMinutes: number; notes?: string | null };
};

type ImportPreviewRow = {
 row: number;
 employeeId?: string | null;
 workDate?: string;
 templateId?: string | null;
 startsAt?: string | null;
 endsAt?: string | null;
 breakMinutes?: number;
 error?: string;
};
type HolidayRow = { date: string; name: string };

const TIMELINE_DAY_WIDTH = 180;

function fmtMinutes(m: number) {
 const hour = Math.floor(m / 60);
 const minute = m % 60;
 return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function toYmd(dateIsoLike: string) {
 return new Date(dateIsoLike).toISOString().slice(0, 10);
}

function addDays(ymd: string, days: number) {
 const d = new Date(`${ymd}T12:00:00`);
 d.setDate(d.getDate() + days);
 return d.toISOString().slice(0, 10);
}

function startOfWeek(ymd: string) {
 const d = new Date(`${ymd}T12:00:00`);
 const day = d.getDay();
 const mondayOffset = day === 0 ? -6 : 1 - day;
 d.setDate(d.getDate() + mondayOffset);
 return d.toISOString().slice(0, 10);
}

function hoursBetween(startIso: string, endIso: string, breakMinutes = 0) {
 const ms = new Date(endIso).getTime() - new Date(startIso).getTime() - breakMinutes * 60 * 1000;
 return Math.max(0, ms / (60 * 60 * 1000));
}

/** Single-line shift label for narrow timeline bars (24h, en dash). */
function formatShiftRangeCompact(startIso: string, endIso: string) {
 const o: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
 return `${new Date(startIso).toLocaleTimeString(undefined, o)}–${new Date(endIso).toLocaleTimeString(undefined, o)}`;
}

export default function RotaPage() {
 const { activeEntity } = useEntity();
 const [loading, setLoading] = useState(true);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const [clients, setClients] = useState<OutsourcingClient[]>([]);
 const [selectedClientId, setSelectedClientId] = useState('');
 const [employees, setEmployees] = useState<Employee[]>([]);
 const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
 const [periods, setPeriods] = useState<RotaPeriod[]>([]);
 const [selectedPeriodId, setSelectedPeriodId] = useState('');
 const [assignments, setAssignments] = useState<Assignment[]>([]);
 const [conflicts, setConflicts] = useState<Conflict[]>([]);

 const [newTemplate, setNewTemplate] = useState({
 name: '',
 startMinutes: 8 * 60,
 endMinutes: 17 * 60,
 breakMinutes: 60,
 color: '#1d4ed8',
 });
 const [newPeriod, setNewPeriod] = useState({
 name: '',
 startDate: '',
 endDate: '',
 });
 const [newAssignment, setNewAssignment] = useState<AssignmentDraft>({
 employeeId: '',
 workDate: '',
 shiftTemplateId: '',
 startTime: '08:00',
 endTime: '17:00',
 breakMinutes: 60,
 notes: '',
 useTemplate: true,
 });
 const [weekAnchorDate, setWeekAnchorDate] = useState('');
 const [bulkTemplateId, setBulkTemplateId] = useState('');
 const [bulkEmployeeIds, setBulkEmployeeIds] = useState<string[]>([]);
 const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
 const [editAssignment, setEditAssignment] = useState<AssignmentDraft>({
 employeeId: '',
 workDate: '',
 shiftTemplateId: '',
 startTime: '08:00',
 endTime: '17:00',
 breakMinutes: 60,
 notes: '',
 useTemplate: true,
 });
 const [csvFile, setCsvFile] = useState<File | null>(null);
 const [importPreview, setImportPreview] = useState<{
 parseErrors?: Array<{ row: number; message: string }>;
 rows?: ImportPreviewRow[];
 } | null>(null);
 const [plannerSearch, setPlannerSearch] = useState('');
 const [bulkFailures, setBulkFailures] = useState<BulkFailure[]>([]);
 const plannerSearchRef = useRef<HTMLInputElement | null>(null);
 const [lastResult, setLastResult] = useState<OperationResult | null>(null);
 const [attendanceOpenExceptions, setAttendanceOpenExceptions] = useState(0);
 const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
 const [plannerView, setPlannerView] = useState<'timeline' | 'table'>('timeline');
 const [weekHolidays, setWeekHolidays] = useState<Map<string, string>>(new Map());

 const selectedPeriod = useMemo(
 () => periods.find((p) => p.id === selectedPeriodId) ?? null,
 [periods, selectedPeriodId],
 );
 const isPublished = selectedPeriod?.status === 'published';

 const weekDays = useMemo(() => {
 const anchor = weekAnchorDate || selectedPeriod?.startDate?.slice(0, 10) || new Date().toISOString().slice(0, 10);
 const start = startOfWeek(anchor);
 return Array.from({ length: 7 }, (_, i) => addDays(start, i));
 }, [selectedPeriod?.startDate, weekAnchorDate]);

 const assignmentsByKey = useMemo(() => {
 const map = new Map<string, Assignment[]>();
 for (const a of assignments) {
 const key = `${a.employeeId}|${toYmd(a.workDate)}`;
 const cur = map.get(key) ?? [];
 cur.push(a);
 map.set(key, cur);
 }
 return map;
 }, [assignments]);

 const dayTotals = useMemo(() => {
 const out: Record<string, { shifts: number; hours: number }> = {};
 for (const d of weekDays) out[d] = { shifts: 0, hours: 0 };
 for (const a of assignments) {
 const d = toYmd(a.workDate);
 if (!out[d]) continue;
 out[d]!.shifts += 1;
 out[d]!.hours += hoursBetween(a.startsAt, a.endsAt, a.breakMinutes);
 }
 return out;
 }, [assignments, weekDays]);

 const conflictsByEmployee = useMemo(() => {
 const map = new Map<string, Conflict[]>();
 for (const c of conflicts) {
 const cur = map.get(c.employeeId) ?? [];
 cur.push(c);
 map.set(c.employeeId, cur);
 }
 return map;
 }, [conflicts]);

 const filteredEmployees = useMemo(() => {
 const q = plannerSearch.trim().toLowerCase();
 if (!q) return employees;
 return employees.filter((e) => {
 const label = `${e.employeeNumber ?? ''} ${e.firstName} ${e.lastName}`.toLowerCase();
 return label.includes(q);
 });
 }, [employees, plannerSearch]);

 const assignmentTemplateColor = useMemo(() => {
 const map = new Map<string, string>();
 for (const t of templates) {
 if (t.color) map.set(t.id, t.color);
 }
 return map;
 }, [templates]);

 const timelineRows = useMemo(() => {
 return filteredEmployees.map((employee) => {
 const all = assignments.filter((a) => a.employeeId === employee.id);
 const weekAssignments = all
 .map((a) => {
 const workYmd = toYmd(a.workDate);
 const dayIndex = weekDays.indexOf(workYmd);
 if (dayIndex < 0) return null;
 const dayStart = new Date(`${workYmd}T00:00:00`).getTime();
 const dayEnd = dayStart + 24 * 60 * 60 * 1000;
 const start = new Date(a.startsAt).getTime();
 const end = new Date(a.endsAt).getTime();
 const clampedStart = Math.max(start, dayStart);
 const clampedEnd = Math.min(end, dayEnd);
 if (clampedEnd <= clampedStart) return null;
 const startHourOffset = (clampedStart - dayStart) / (1000 * 60 * 60);
 const endHourOffset = (clampedEnd - dayStart) / (1000 * 60 * 60);
 return {
 assignment: a,
 startMs: clampedStart,
 endMs: clampedEnd,
 dayIndex,
 startHourOffset,
 endHourOffset,
 };
 })
 .filter((x): x is NonNullable<typeof x> => Boolean(x))
 .sort((a, b) => a.startMs - b.startMs);

 const laneEnds: number[] = [];
 const bars = weekAssignments.map((entry) => {
 let lane = laneEnds.findIndex((end) => end <= entry.startMs);
 if (lane === -1) {
 lane = laneEnds.length;
 laneEnds.push(entry.endMs);
 } else {
 laneEnds[lane] = entry.endMs;
 }
 return { ...entry, lane };
 });

 return {
 employee,
 bars,
 laneCount: Math.max(1, laneEnds.length),
 };
 });
 }, [assignments, filteredEmployees, weekDays]);

 const readJson = useCallback(async <T,>(res: Response): Promise<T> => {
 const body = await res.json().catch(() => ({}));
 if (!res.ok) {
 const msg = typeof body?.error === 'string' ? body.error : 'Request failed';
 throw new Error(msg);
 }
 return body as T;
 }, []);

 const loadClients = useCallback(async () => {
 const res = await fetch('/api/outsourcing/clients', { cache: 'no-store' });
 const data = await readJson<OutsourcingClient[]>(res);
 setClients(data);
 setSelectedClientId((prev) => {
 if (data.length === 1 && data[0]?.id) return data[0].id;
 if (!prev && data[0]?.id) return data[0].id;
 if (prev && data.some((c) => c.id === prev)) return prev;
 return data[0]?.id ?? '';
 });
 }, [readJson]);

 const loadClientContext = useCallback(async (clientId: string) => {
 const [empRes, tRes, pRes] = await Promise.all([
 fetch(`/api/outsourcing/employees?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' }),
 fetch(`/api/rota/templates?outsourcingClientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' }),
 fetch(`/api/rota/periods?outsourcingClientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' }),
 ]);
 const [empData, tData, pData] = await Promise.all([
 readJson<Employee[]>(empRes),
 readJson<ShiftTemplate[]>(tRes),
 readJson<RotaPeriod[]>(pRes),
 ]);
 setEmployees(empData);
 setTemplates(tData);
 setPeriods(pData);
 setSelectedPeriodId((pid) => {
 if (pid && pData.some((p) => p.id === pid)) return pid;
 return pData[0]?.id ?? '';
 });
 }, [readJson]);

 const loadAssignments = useCallback(async (periodId: string) => {
 if (!periodId) return;
 const res = await fetch(`/api/rota/assignments?rotaPeriodId=${encodeURIComponent(periodId)}`, { cache: 'no-store' });
 const data = await readJson<Assignment[]>(res);
 setAssignments(data);
 }, [readJson]);

 const refreshAll = useCallback(async () => {
 setError(null);
 setLoading(true);
 try {
 await loadClients();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to load rota module');
 } finally {
 setLoading(false);
 }
 }, [loadClients]);

 useEffect(() => {
 void refreshAll();
 }, [refreshAll, activeEntity.id]);

 useEffect(() => {
 if (!selectedClientId) return;
 setError(null);
 setBusy(true);
 void loadClientContext(selectedClientId)
 .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load rota data'))
 .finally(() => setBusy(false));
 }, [loadClientContext, selectedClientId]);

 useEffect(() => {
 if (!selectedPeriodId) return;
 setBusy(true);
 void loadAssignments(selectedPeriodId)
 .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load assignments'))
 .finally(() => setBusy(false));
 }, [loadAssignments, selectedPeriodId]);

 useEffect(() => {
 if (!selectedClientId) return;
 void (async () => {
 const from = weekDays[0];
 const to = weekDays[6];
 const [attendanceRes, leaveRes] = await Promise.all([
 fetch(
 `/api/outsourcing/attendance?clientId=${encodeURIComponent(selectedClientId)}&from=${from}&to=${to}`,
 { cache: 'no-store' },
 ),
 fetch('/api/staff/leave/applications?scope=team&status=pending', { cache: 'no-store' }),
 ]);
 const attendanceJson = await attendanceRes.json().catch(() => ({}));
 const leaveJson = await leaveRes.json().catch(() => []);
 setAttendanceOpenExceptions(
 Array.isArray(attendanceJson.exceptions)
 ? attendanceJson.exceptions.filter((e: { status?: string }) => e.status === 'open').length
 : 0,
 );
 setPendingLeaveCount(Array.isArray(leaveJson) ? leaveJson.length : 0);
 })();
 }, [selectedClientId, weekDays, activeEntity.id]);

 useEffect(() => {
 const y = new Date(`${weekDays[0]}T00:00:00.000Z`).getUTCFullYear();
 void (async () => {
 const res = await fetch(`/api/admin/holidays/year/${y}`, { cache: 'no-store' });
 const json = await res.json().catch(() => []);
 if (!res.ok || !Array.isArray(json)) return;
 const map = new Map<string, string>();
 for (const item of json as HolidayRow[]) {
 map.set(item.date.slice(0, 10), item.name);
 }
 setWeekHolidays(map);
 })();
 }, [weekDays]);

 async function createTemplate() {
 if (!selectedClientId || !newTemplate.name.trim()) return;
 setBusy(true);
 setError(null);
 try {
 const res = await fetch('/api/rota/templates', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 outsourcingClientId: selectedClientId,
 name: newTemplate.name.trim(),
 startMinutes: newTemplate.startMinutes,
 endMinutes: newTemplate.endMinutes,
 breakMinutes: newTemplate.breakMinutes,
 color: newTemplate.color,
 }),
 });
 await readJson<ShiftTemplate>(res);
 setNewTemplate((s) => ({ ...s, name: '' }));
 await loadClientContext(selectedClientId);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to create template');
 } finally {
 setBusy(false);
 }
 }

 async function createPeriod() {
 if (!selectedClientId || !newPeriod.startDate || !newPeriod.endDate) return;
 setBusy(true);
 setError(null);
 try {
 const res = await fetch('/api/rota/periods', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 outsourcingClientId: selectedClientId,
 name: newPeriod.name.trim() || null,
 startDate: newPeriod.startDate,
 endDate: newPeriod.endDate,
 status: 'draft',
 }),
 });
 const period = await readJson<RotaPeriod>(res);
 setNewPeriod({ name: '', startDate: '', endDate: '' });
 await loadClientContext(selectedClientId);
 setSelectedPeriodId(period.id);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to create period');
 } finally {
 setBusy(false);
 }
 }

 async function updatePeriodStatus(periodId: string, status: 'draft' | 'published') {
 setBusy(true);
 setError(null);
 try {
 const res = await fetch(`/api/rota/periods/${periodId}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ status }),
 });
 await readJson<RotaPeriod>(res);
 if (selectedClientId) await loadClientContext(selectedClientId);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to update period');
 } finally {
 setBusy(false);
 }
 }

 async function createAssignment() {
 if (!selectedPeriodId || !newAssignment.employeeId || !newAssignment.workDate) return;
 setBusy(true);
 setError(null);
 try {
 const optimisticId = `temp-${Date.now()}`;
 const optimisticStart = newAssignment.useTemplate
 ? `${newAssignment.workDate}T00:00:00.000Z`
 : new Date(`${newAssignment.workDate}T${newAssignment.startTime}:00`).toISOString();
 const optimisticEnd = newAssignment.useTemplate
 ? `${newAssignment.workDate}T00:00:00.000Z`
 : new Date(`${newAssignment.workDate}T${newAssignment.endTime}:00`).toISOString();
 const optimistic: Assignment = {
 id: optimisticId,
 employeeId: newAssignment.employeeId,
 workDate: newAssignment.workDate,
 startsAt: optimisticStart,
 endsAt: optimisticEnd,
 breakMinutes: newAssignment.breakMinutes,
 notes: newAssignment.notes || null,
 employee: (() => {
 const e = employees.find((x) => x.id === newAssignment.employeeId);
 return e ? { firstName: e.firstName, lastName: e.lastName, employeeNumber: e.employeeNumber } : undefined;
 })(),
 shiftTemplate: (() => {
 const t = templates.find((x) => x.id === newAssignment.shiftTemplateId);
 return t ? { id: t.id, name: t.name, color: t.color } : undefined;
 })(),
 };
 setAssignments((prev) => [optimistic, ...prev]);
 const payload: Record<string, unknown> = {
 rotaPeriodId: selectedPeriodId,
 employeeId: newAssignment.employeeId,
 workDate: newAssignment.workDate,
 breakMinutes: newAssignment.breakMinutes,
 notes: newAssignment.notes.trim() || null,
 };
 if (newAssignment.useTemplate && newAssignment.shiftTemplateId) {
 payload.shiftTemplateId = newAssignment.shiftTemplateId;
 } else {
 payload.startTime = newAssignment.startTime;
 payload.endTime = newAssignment.endTime;
 }
 const res = await fetch('/api/rota/assignments', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });
 const created = await readJson<Assignment>(res);
 setAssignments((prev) => prev.map((a) => (a.id === optimisticId ? created : a)));
 setNewAssignment((s) => ({ ...s, notes: '' }));
 setLastResult({ title: 'Assignment created', created: 1 });
 } catch (e) {
 setAssignments((prev) => prev.filter((a) => !a.id.startsWith('temp-')));
 setError(e instanceof Error ? e.message : 'Failed to create assignment');
 } finally {
 setBusy(false);
 }
 }

 async function updateAssignment(assignmentId: string, payload: AssignmentDraft) {
 setBusy(true);
 setError(null);
 try {
 const previous = assignments.find((a) => a.id === assignmentId);
 if (previous) {
 setAssignments((prev) =>
 prev.map((a) =>
 a.id === assignmentId
 ? {
 ...a,
 workDate: payload.workDate,
 breakMinutes: payload.breakMinutes,
 notes: payload.notes || null,
 startsAt: new Date(`${payload.workDate}T${payload.startTime}:00`).toISOString(),
 endsAt: new Date(`${payload.workDate}T${payload.endTime}:00`).toISOString(),
 }
 : a,
 ),
 );
 }
 const body: Record<string, unknown> = {
 workDate: payload.workDate,
 breakMinutes: payload.breakMinutes,
 notes: payload.notes.trim() || null,
 };
 if (payload.useTemplate && payload.shiftTemplateId) {
 body.shiftTemplateId = payload.shiftTemplateId;
 } else {
 body.startTime = payload.startTime;
 body.endTime = payload.endTime;
 }
 const res = await fetch(`/api/rota/assignments/${assignmentId}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 });
 const updated = await readJson<Assignment>(res);
 setAssignments((prev) => prev.map((a) => (a.id === assignmentId ? updated : a)));
 setEditingAssignmentId(null);
 setLastResult({ title: 'Assignment updated', updated: 1 });
 } catch (e) {
 await loadAssignments(selectedPeriodId);
 setError(e instanceof Error ? e.message : 'Failed to update assignment');
 } finally {
 setBusy(false);
 }
 }

 async function removeAssignment(assignmentId: string) {
 setBusy(true);
 setError(null);
 try {
 setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
 const res = await fetch(`/api/rota/assignments/${assignmentId}`, { method: 'DELETE' });
 await readJson<{ ok: true }>(res);
 setLastResult({ title: 'Assignment deleted', deleted: 1 });
 } catch (e) {
 await loadAssignments(selectedPeriodId);
 setError(e instanceof Error ? e.message : 'Failed to delete assignment');
 } finally {
 setBusy(false);
 }
 }

 const scanConflicts = useCallback(async () => {
 if (!selectedPeriodId) return;
 setBusy(true);
 setError(null);
 try {
 const res = await fetch(`/api/rota/conflicts?rotaPeriodId=${encodeURIComponent(selectedPeriodId)}`, {
 cache: 'no-store',
 });
 const data = await readJson<{ conflicts: Conflict[] }>(res);
 setConflicts(data.conflicts ?? []);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to scan conflicts');
 } finally {
 setBusy(false);
 }
 }, [readJson, selectedPeriodId]);

 async function previewImport() {
 if (!selectedClientId || !csvFile) return;
 setBusy(true);
 setError(null);
 try {
 const fd = new FormData();
 fd.append('file', csvFile);
 fd.append('clientId', selectedClientId);
 const res = await fetch('/api/rota/import/preview', { method: 'POST', body: fd });
 const data = await readJson<{
 parseErrors?: Array<{ row: number; message: string }>;
 rows?: ImportPreviewRow[];
 }>(res);
 setImportPreview(data);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to preview import');
 } finally {
 setBusy(false);
 }
 }

 async function commitImport() {
 if (!selectedClientId || !selectedPeriodId || !csvFile) return;
 setBusy(true);
 setError(null);
 try {
 const fd = new FormData();
 fd.append('file', csvFile);
 fd.append('clientId', selectedClientId);
 fd.append('rotaPeriodId', selectedPeriodId);
 const res = await fetch('/api/rota/import/commit', { method: 'POST', body: fd });
 const data = await readJson<{ ok: boolean; created?: number; skipped?: Array<{ row: number; reason: string }> }>(res);
 await loadAssignments(selectedPeriodId);
 const csvFailures: BulkFailure[] = [];
 if (data.skipped?.length && importPreview?.rows?.length) {
 for (const s of data.skipped) {
 const row = importPreview.rows.find((r) => r.row === s.row);
 if (!row?.employeeId || !row.workDate) continue;
 if (row.templateId) {
 csvFailures.push({
 id: `csv-${row.row}-${Date.now()}`,
 source: 'csv',
 employeeId: row.employeeId,
 workDate: row.workDate,
 reason: s.reason,
 payload: { shiftTemplateId: row.templateId },
 });
 } else if (row.startsAt && row.endsAt) {
 csvFailures.push({
 id: `csv-${row.row}-${Date.now()}`,
 source: 'csv',
 employeeId: row.employeeId,
 workDate: row.workDate,
 reason: s.reason,
 payload: {
 startsAt: row.startsAt,
 endsAt: row.endsAt,
 breakMinutes: row.breakMinutes ?? 0,
 },
 });
 }
 }
 }
 setBulkFailures((prev) => [...csvFailures, ...prev]);
 setImportPreview(null);
 setLastResult({
 title: 'CSV import committed',
 created: data.created ?? 0,
 skipped: data.skipped?.length ?? 0,
 });
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to commit import');
 } finally {
 setBusy(false);
 }
 }

 async function copyPreviousWeek() {
 if (!selectedPeriodId || !weekDays.length || isPublished) return;
 setBusy(true);
 setError(null);
 try {
 const currentStart = weekDays[0]!;
 const previousStart = addDays(currentStart, -7);
 let createdCount = 0;
 let skippedCount = 0;
 let conflictsCount = 0;
 const failures: BulkFailure[] = [];
 for (const employee of employees) {
 for (let i = 0; i < 7; i++) {
 const prevDate = addDays(previousStart, i);
 const nextDate = addDays(currentStart, i);
 const prevShifts = assignmentsByKey.get(`${employee.id}|${prevDate}`) ?? [];
 for (const s of prevShifts) {
 const res = await fetch('/api/rota/assignments', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 rotaPeriodId: selectedPeriodId,
 employeeId: employee.id,
 workDate: nextDate,
 startsAt: s.startsAt,
 endsAt: s.endsAt,
 breakMinutes: s.breakMinutes,
 notes: s.notes,
 }),
 });
 if (res.ok) createdCount += 1;
 else if (res.status === 409) {
 conflictsCount += 1;
 skippedCount += 1;
 failures.push({
 id: `copy-${employee.id}-${nextDate}-${Date.now()}`,
 source: 'copy-week',
 employeeId: employee.id,
 workDate: nextDate,
 reason: 'Conflict',
 payload: {
 startsAt: s.startsAt,
 endsAt: s.endsAt,
 breakMinutes: s.breakMinutes,
 notes: s.notes,
 },
 });
 } else {
 skippedCount += 1;
 failures.push({
 id: `copy-${employee.id}-${nextDate}-${Date.now()}`,
 source: 'copy-week',
 employeeId: employee.id,
 workDate: nextDate,
 reason: `HTTP ${res.status}`,
 payload: {
 startsAt: s.startsAt,
 endsAt: s.endsAt,
 breakMinutes: s.breakMinutes,
 notes: s.notes,
 },
 });
 }
 }
 }
 }
 if (failures.length) setBulkFailures((prev) => [...failures, ...prev]);
 await loadAssignments(selectedPeriodId);
 setLastResult({
 title: 'Copy previous week completed',
 created: createdCount,
 skipped: skippedCount,
 conflicts: conflictsCount,
 });
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to copy previous week');
 } finally {
 setBusy(false);
 }
 }

 async function bulkAssignWeekTemplate() {
 if (!selectedPeriodId || !bulkTemplateId || !bulkEmployeeIds.length || isPublished) return;
 setBusy(true);
 setError(null);
 try {
 let createdCount = 0;
 let skippedCount = 0;
 let conflictCount = 0;
 const failures: BulkFailure[] = [];
 for (const employeeId of bulkEmployeeIds) {
 for (const day of weekDays) {
 const res = await fetch('/api/rota/assignments', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 rotaPeriodId: selectedPeriodId,
 employeeId,
 workDate: day,
 shiftTemplateId: bulkTemplateId,
 }),
 });
 if (res.ok) createdCount += 1;
 else if (res.status === 409) {
 conflictCount += 1;
 skippedCount += 1;
 failures.push({
 id: `bulk-${employeeId}-${day}-${Date.now()}`,
 source: 'bulk-template',
 employeeId,
 workDate: day,
 reason: 'Conflict',
 payload: { shiftTemplateId: bulkTemplateId },
 });
 } else {
 skippedCount += 1;
 failures.push({
 id: `bulk-${employeeId}-${day}-${Date.now()}`,
 source: 'bulk-template',
 employeeId,
 workDate: day,
 reason: `HTTP ${res.status}`,
 payload: { shiftTemplateId: bulkTemplateId },
 });
 }
 }
 }
 if (failures.length) setBulkFailures((prev) => [...failures, ...prev]);
 await loadAssignments(selectedPeriodId);
 setLastResult({
 title: 'Bulk weekly assignment completed',
 created: createdCount,
 skipped: skippedCount,
 conflicts: conflictCount,
 });
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to run bulk assignment');
 } finally {
 setBusy(false);
 }
 }

 async function ensureDefaultShiftTemplates() {
 if (!selectedClientId) return {} as Record<'day' | 'evening' | 'night', string>;
 const defs = [
 { key: 'day' as const, name: 'Day shift', startMinutes: 7 * 60, endMinutes: 15 * 60, breakMinutes: 45, color: '#3b82f6' },
 { key: 'evening' as const, name: 'Evening shift', startMinutes: 15 * 60, endMinutes: 23 * 60, breakMinutes: 45, color: '#f59e0b' },
 { key: 'night' as const, name: 'Night shift', startMinutes: 23 * 60, endMinutes: 7 * 60, breakMinutes: 60, color: '#8b5cf6' },
 ];
 const templateMap: Record<'day' | 'evening' | 'night', string> = {
 day: '',
 evening: '',
 night: '',
 };

 for (const def of defs) {
 const existing = templates.find((t) => t.name.toLowerCase() === def.name.toLowerCase());
 if (existing) {
 templateMap[def.key] = existing.id;
 continue;
 }
 const res = await fetch('/api/rota/templates', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 outsourcingClientId: selectedClientId,
 name: def.name,
 startMinutes: def.startMinutes,
 endMinutes: def.endMinutes,
 breakMinutes: def.breakMinutes,
 color: def.color,
 }),
 });
 const created = await readJson<ShiftTemplate>(res);
 templateMap[def.key] = created.id;
 }

 if (Object.values(templateMap).some((id) => !id)) {
 throw new Error('Failed to resolve shift templates');
 }
 await loadClientContext(selectedClientId);
 return templateMap;
 }

 async function seedDemoWeekFromExistingEmployees() {
 if (!selectedPeriodId || !weekDays.length || !employees.length || isPublished) return;
 setBusy(true);
 setError(null);
 try {
 const templateIds = await ensureDefaultShiftTemplates();
 const shiftCycle: Array<'day' | 'day' | 'evening' | 'evening' | 'night' | 'night' | 'off'> = [
 'day',
 'day',
 'evening',
 'evening',
 'night',
 'night',
 'off',
 ];
 let created = 0;
 let skipped = 0;
 let conflictsCount = 0;

 for (const [employeeIdx, employee] of employees.entries()) {
 const offset = employeeIdx % shiftCycle.length;
 for (const [dayIdx, day] of weekDays.entries()) {
 const slot = shiftCycle[(dayIdx + offset) % shiftCycle.length];
 if (slot === 'off') continue;

 const key = `${employee.id}|${day}`;
 const alreadyHasShift = (assignmentsByKey.get(key) ?? []).length > 0;
 if (alreadyHasShift) {
 skipped += 1;
 continue;
 }

 const res = await fetch('/api/rota/assignments', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 rotaPeriodId: selectedPeriodId,
 employeeId: employee.id,
 workDate: day,
 shiftTemplateId: templateIds[slot],
 }),
 });

 if (res.ok) created += 1;
 else {
 skipped += 1;
 if (res.status === 409) conflictsCount += 1;
 }
 }
 }

 await loadAssignments(selectedPeriodId);
 setLastResult({
 title: 'Demo rota week seeded using existing employees',
 created,
 skipped,
 conflicts: conflictsCount,
 });
 setPlannerView('timeline');
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to seed rota week');
 } finally {
 setBusy(false);
 }
 }

 async function retryFailure(failure: BulkFailure) {
 if (!selectedPeriodId || isPublished) return;
 setBusy(true);
 setError(null);
 try {
 const body: Record<string, unknown> = {
 rotaPeriodId: selectedPeriodId,
 employeeId: failure.employeeId,
 workDate: failure.workDate,
 };
 if ('shiftTemplateId' in failure.payload) {
 body.shiftTemplateId = failure.payload.shiftTemplateId;
 } else {
 body.startsAt = failure.payload.startsAt;
 body.endsAt = failure.payload.endsAt;
 body.breakMinutes = failure.payload.breakMinutes;
 if (failure.payload.notes) body.notes = failure.payload.notes;
 }
 const res = await fetch('/api/rota/assignments', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 });
 await readJson<Assignment>(res);
 setBulkFailures((prev) => prev.filter((f) => f.id !== failure.id));
 await loadAssignments(selectedPeriodId);
 setLastResult({ title: 'Retry successful', created: 1 });
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Retry failed');
 } finally {
 setBusy(false);
 }
 }

 async function retryAllFailures() {
 if (!bulkFailures.length || !selectedPeriodId || isPublished) return;
 setBusy(true);
 setError(null);
 let created = 0;
 let skipped = 0;
 let conflicts = 0;
 const remaining: BulkFailure[] = [];
 try {
 for (const f of bulkFailures) {
 const body: Record<string, unknown> = {
 rotaPeriodId: selectedPeriodId,
 employeeId: f.employeeId,
 workDate: f.workDate,
 };
 if ('shiftTemplateId' in f.payload) {
 body.shiftTemplateId = f.payload.shiftTemplateId;
 } else {
 body.startsAt = f.payload.startsAt;
 body.endsAt = f.payload.endsAt;
 body.breakMinutes = f.payload.breakMinutes;
 if (f.payload.notes) body.notes = f.payload.notes;
 }
 const res = await fetch('/api/rota/assignments', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 });
 if (res.ok) {
 created += 1;
 } else {
 skipped += 1;
 if (res.status === 409) conflicts += 1;
 remaining.push(f);
 }
 }
 setBulkFailures(remaining);
 await loadAssignments(selectedPeriodId);
 setLastResult({
 title: 'Retry all completed',
 created,
 skipped,
 conflicts,
 });
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Retry all failed');
 } finally {
 setBusy(false);
 }
 }

 function exportFailedRowsCsv() {
 if (!bulkFailures.length) return;
 const lines = [
 'source,employee_id,employee_number,employee_name,work_date,reason,payload_kind,shift_template_or_start,ends_at,break_minutes',
 ];
 for (const f of bulkFailures) {
 const emp = employees.find((e) => e.id === f.employeeId);
 const empNo = emp?.employeeNumber ?? '';
 const empName = emp ? `${emp.firstName} ${emp.lastName}` : '';
 const isTemplate = 'shiftTemplateId' in f.payload;
 let startOrTemplate: string;
 let end: string;
 let br: string;
 if ('shiftTemplateId' in f.payload) {
 startOrTemplate = f.payload.shiftTemplateId;
 end = '';
 br = '';
 } else {
 startOrTemplate = f.payload.startsAt;
 end = f.payload.endsAt;
 br = String(f.payload.breakMinutes);
 }
 const row = [
 f.source,
 f.employeeId,
 empNo,
 empName,
 f.workDate,
 f.reason.replace(/,/g, ';'),
 isTemplate ? 'template' : 'custom',
 startOrTemplate,
 end,
 br,
 ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
 lines.push(row.join(','));
 }
 const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `rota-failed-rows-${new Date().toISOString().slice(0, 10)}.csv`;
 document.body.appendChild(a);
 a.click();
 a.remove();
 URL.revokeObjectURL(url);
 }

 useEffect(() => {
 function onKey(e: KeyboardEvent) {
 const target = e.target as HTMLElement | null;
 const tag = target?.tagName?.toLowerCase();
 const typing = tag === 'input' || tag === 'textarea' || target?.isContentEditable;
 if (typing) return;
 const key = e.key.toLowerCase();
 if (key === 'r') {
 e.preventDefault();
 void refreshAll();
 } else if (key === 'c') {
 e.preventDefault();
 void scanConflicts();
 } else if (e.key === '[') {
 e.preventDefault();
 setWeekAnchorDate((d) => addDays(d || weekDays[0]!, -7));
 } else if (e.key === ']') {
 e.preventDefault();
 setWeekAnchorDate((d) => addDays(d || weekDays[0]!, 7));
 } else if (key === 's') {
 e.preventDefault();
 plannerSearchRef.current?.focus();
 }
 }
 window.addEventListener('keydown', onKey);
 return () => window.removeEventListener('keydown', onKey);
 }, [plannerSearchRef, refreshAll, scanConflicts, weekDays]);

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Rota planner"
 description="Build shift templates, plan periods, assign staff, scan conflicts, and import from CSV."
 actions={
 <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
 <select
 value={selectedClientId}
 onChange={(e) => setSelectedClientId(e.target.value)}
 className="h-10 rounded-lg border border-neutral-300 px-3 text-sm bg-white min-w-[220px]"
 >
 <option value="">Select workspace</option>
 {clients.map((c) => (
 <option key={c.id} value={c.id}>
 {c.name}
 </option>
 ))}
 </select>
 <button
 type="button"
 onClick={() => void refreshAll()}
 className="btn-secondary inline-flex h-10 items-center gap-2"
 >
 <RefreshCw className={`h-4 w-4 ${busy || loading ? 'animate-spin' : ''}`} />
 Refresh
 </button>
 </div>
 }
 />

 {error ? (
 <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
 ) : null}
 {lastResult ? (
 <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
 <div className="font-semibold">{lastResult.title}</div>
 <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
 {lastResult.created != null ? <span>Created: {lastResult.created}</span> : null}
 {lastResult.updated != null ? <span>Updated: {lastResult.updated}</span> : null}
 {lastResult.deleted != null ? <span>Deleted: {lastResult.deleted}</span> : null}
 {lastResult.skipped != null ? <span>Skipped: {lastResult.skipped}</span> : null}
 {lastResult.conflicts != null ? <span>Conflicts: {lastResult.conflicts}</span> : null}
 {lastResult.message ? <span>{lastResult.message}</span> : null}
 </div>
 </div>
 ) : null}

 <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
 Weekly signals - open attendance exceptions: {attendanceOpenExceptions} | pending leave approvals: {pendingLeaveCount}
 </div>

 <div className="mb-5 text-xs text-neutral-500">
 {loading
 ? 'Loading rota workspace...'
 : `${employees.length} employees, ${templates.length} templates, ${periods.length} periods`}
 </div>

 <div className="grid gap-4 sm:grid-cols-2">
 <div className="dashboard-surface shadow-sm p-5">
 <div className="flex items-center justify-between gap-2 text-primary-800 font-semibold mb-2">
 <div className="flex items-center gap-2">
 <LayoutGrid className="w-5 h-5" />
 Shift templates
 </div>
 </div>
 <div className="space-y-2 mb-3">
 <input
 value={newTemplate.name}
 onChange={(e) => setNewTemplate((s) => ({ ...s, name: e.target.value }))}
 className="w-full h-9 rounded border border-neutral-300 px-2 text-sm"
 placeholder="Template name (e.g. Morning)"
 />
 <div className="grid grid-cols-3 gap-2">
 <input
 type="number"
 value={newTemplate.startMinutes}
 onChange={(e) =>
 setNewTemplate((s) => ({ ...s, startMinutes: Math.max(0, parseInt(e.target.value || '0', 10)) }))
 }
 className="h-9 rounded border border-neutral-300 px-2 text-sm"
 placeholder="Start min"
 />
 <input
 type="number"
 value={newTemplate.endMinutes}
 onChange={(e) =>
 setNewTemplate((s) => ({ ...s, endMinutes: Math.max(0, parseInt(e.target.value || '0', 10)) }))
 }
 className="h-9 rounded border border-neutral-300 px-2 text-sm"
 placeholder="End min"
 />
 <input
 type="number"
 value={newTemplate.breakMinutes}
 onChange={(e) =>
 setNewTemplate((s) => ({ ...s, breakMinutes: Math.max(0, parseInt(e.target.value || '0', 10)) }))
 }
 className="h-9 rounded border border-neutral-300 px-2 text-sm"
 placeholder="Break"
 />
 </div>
 <button
 type="button"
 onClick={() => void createTemplate()}
 disabled={!selectedClientId || busy}
 className="h-9 rounded bg-primary-700 text-white px-3 text-sm inline-flex items-center gap-2 disabled:opacity-50"
 >
 <Plus className="w-4 h-4" />
 Add template
 </button>
 </div>
 <div className="space-y-1 max-h-40 overflow-auto">
 {templates.map((t) => (
 <div key={t.id} className="text-xs rounded border border-neutral-200 px-2 py-1 bg-neutral-50">
 <span className="font-medium text-neutral-800">{t.name}</span> - {fmtMinutes(t.startMinutes)} to{' '}
 {fmtMinutes(t.endMinutes)} (break {t.breakMinutes}m)
 </div>
 ))}
 {!templates.length ? <p className="text-xs text-neutral-500">No templates yet.</p> : null}
 </div>
 </div>

 <div className="dashboard-surface shadow-sm p-5">
 <div className="flex items-center gap-2 text-primary-800 font-semibold mb-2">
 <CalendarRange className="w-5 h-5" />
 Rota periods
 </div>
 <div className="space-y-2 mb-3">
 <input
 value={newPeriod.name}
 onChange={(e) => setNewPeriod((s) => ({ ...s, name: e.target.value }))}
 className="w-full h-9 rounded border border-neutral-300 px-2 text-sm"
 placeholder="Period name (optional)"
 />
 <div className="grid grid-cols-2 gap-2">
 <input
 type="date"
 value={newPeriod.startDate}
 onChange={(e) => setNewPeriod((s) => ({ ...s, startDate: e.target.value }))}
 className="h-9 rounded border border-neutral-300 px-2 text-sm"
 />
 <input
 type="date"
 value={newPeriod.endDate}
 onChange={(e) => setNewPeriod((s) => ({ ...s, endDate: e.target.value }))}
 className="h-9 rounded border border-neutral-300 px-2 text-sm"
 />
 </div>
 <button
 type="button"
 onClick={() => void createPeriod()}
 disabled={!selectedClientId || busy}
 className="h-9 rounded bg-primary-700 text-white px-3 text-sm inline-flex items-center gap-2 disabled:opacity-50"
 >
 <Plus className="w-4 h-4" />
 Add period
 </button>
 </div>
 <div className="space-y-1 max-h-40 overflow-auto">
 {periods.map((p) => (
 <button
 key={p.id}
 type="button"
 onClick={() => setSelectedPeriodId(p.id)}
 className={`w-full text-left text-xs rounded border px-2 py-2 ${
 selectedPeriodId === p.id
 ? 'border-primary-500 bg-primary-50'
 : 'border-neutral-200 bg-neutral-50'
 }`}
 >
 <div className="font-medium text-neutral-800">{p.name || 'Unnamed period'}</div>
 <div className="text-neutral-600">
 {toYmd(p.startDate)} to {toYmd(p.endDate)} - {p.status}
 </div>
 </button>
 ))}
 {!periods.length ? <p className="text-xs text-neutral-500">No periods yet.</p> : null}
 </div>
 </div>

 <div className="dashboard-surface shadow-sm p-5 sm:col-span-2">
 <div className="flex items-center justify-between gap-2 text-primary-800 font-semibold mb-2">
 <div className="flex items-center gap-2">
 <Clock className="w-5 h-5" />
 Assignments
 </div>
 {selectedPeriod ? (
 <button
 type="button"
 onClick={() =>
 void updatePeriodStatus(selectedPeriod.id, selectedPeriod.status === 'draft' ? 'published' : 'draft')
 }
 className="h-8 rounded border border-neutral-300 px-3 text-xs bg-white"
 >
 Mark as {selectedPeriod.status === 'draft' ? 'published' : 'draft'}
 </button>
 ) : null}
 </div>
 {isPublished ? (
 <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
 This period is published. Assignment create/edit/delete and import are locked until switched back to draft.
 </div>
 ) : null}
 {!selectedPeriodId ? (
 <p className="text-sm text-neutral-600">Select a rota period to manage assignments.</p>
 ) : (
 <>
 <div className="grid gap-2 md:grid-cols-6 mb-3">
 <select
 value={newAssignment.employeeId}
 onChange={(e) => setNewAssignment((s) => ({ ...s, employeeId: e.target.value }))}
 className="h-9 rounded border border-neutral-300 px-2 text-sm md:col-span-2"
 >
 <option value="">Employee</option>
 {employees.map((e) => (
 <option key={e.id} value={e.id}>
 {e.employeeNumber ? `${e.employeeNumber} - ` : ''}
 {e.firstName} {e.lastName}
 </option>
 ))}
 </select>
 <input
 type="date"
 value={newAssignment.workDate}
 onChange={(e) => setNewAssignment((s) => ({ ...s, workDate: e.target.value }))}
 className="h-9 rounded border border-neutral-300 px-2 text-sm"
 />
 <select
 value={newAssignment.useTemplate ? 'template' : 'custom'}
 onChange={(e) => setNewAssignment((s) => ({ ...s, useTemplate: e.target.value === 'template' }))}
 className="h-9 rounded border border-neutral-300 px-2 text-sm"
 >
 <option value="template">Template</option>
 <option value="custom">Custom time</option>
 </select>
 {newAssignment.useTemplate ? (
 <select
 value={newAssignment.shiftTemplateId}
 onChange={(e) => setNewAssignment((s) => ({ ...s, shiftTemplateId: e.target.value }))}
 className="h-9 rounded border border-neutral-300 px-2 text-sm md:col-span-2"
 >
 <option value="">Pick template</option>
 {templates.map((t) => (
 <option key={t.id} value={t.id}>
 {t.name}
 </option>
 ))}
 </select>
 ) : (
 <div className="grid grid-cols-3 gap-2 md:col-span-2">
 <input
 type="time"
 value={newAssignment.startTime}
 onChange={(e) => setNewAssignment((s) => ({ ...s, startTime: e.target.value }))}
 className="h-9 rounded border border-neutral-300 px-2 text-sm"
 />
 <input
 type="time"
 value={newAssignment.endTime}
 onChange={(e) => setNewAssignment((s) => ({ ...s, endTime: e.target.value }))}
 className="h-9 rounded border border-neutral-300 px-2 text-sm"
 />
 <input
 type="number"
 value={newAssignment.breakMinutes}
 onChange={(e) =>
 setNewAssignment((s) => ({
 ...s,
 breakMinutes: Math.max(0, parseInt(e.target.value || '0', 10)),
 }))
 }
 className="h-9 rounded border border-neutral-300 px-2 text-sm"
 placeholder="Break"
 />
 </div>
 )}
 <button
 type="button"
 onClick={() => void createAssignment()}
 disabled={busy || isPublished}
 className="h-9 rounded bg-primary-700 text-white px-3 text-sm disabled:opacity-50"
 >
 Add shift
 </button>
 </div>
 <div className="mb-3 rounded border border-neutral-200 p-3 bg-neutral-50">
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs font-medium text-neutral-700">Week planner</p>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => setWeekAnchorDate((d) => addDays(d || weekDays[0]!, -7))}
 className="h-8 w-8 rounded border border-neutral-300 bg-white inline-flex items-center justify-center"
 >
 <ChevronLeft className="w-4 h-4" />
 </button>
 <span className="text-xs text-neutral-600">{weekDays[0]} to {weekDays[6]}</span>
 <button
 type="button"
 onClick={() => setWeekAnchorDate((d) => addDays(d || weekDays[0]!, 7))}
 className="h-8 w-8 rounded border border-neutral-300 bg-white inline-flex items-center justify-center"
 >
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </div>
 <div className="mb-2 flex flex-wrap items-center gap-2">
 <input
 ref={(el) => {
 plannerSearchRef.current = el;
 }}
 value={plannerSearch}
 onChange={(e) => setPlannerSearch(e.target.value)}
 placeholder="Search employee (shortcut: s)"
 className="h-8 rounded border border-neutral-300 px-2 text-xs bg-white min-w-[220px]"
 />
 <span className="text-[11px] text-neutral-500">
 Showing {filteredEmployees.length} of {employees.length}
 </span>
 <span className="text-[11px] text-neutral-500">Shortcuts: r refresh, c conflicts, [ ] week</span>
 </div>
 <div className="flex flex-wrap items-center gap-2 mb-3">
 <select
 value={bulkTemplateId}
 onChange={(e) => setBulkTemplateId(e.target.value)}
 className="h-8 rounded border border-neutral-300 px-2 text-xs bg-white min-w-[180px]"
 >
 <option value="">Bulk template for week</option>
 {templates.map((t) => (
 <option key={t.id} value={t.id}>
 {t.name}
 </option>
 ))}
 </select>
 <button
 type="button"
 onClick={() => void bulkAssignWeekTemplate()}
 disabled={!bulkTemplateId || !bulkEmployeeIds.length || busy || isPublished}
 className="h-8 rounded border border-neutral-300 px-2 text-xs bg-white inline-flex items-center gap-1 disabled:opacity-50"
 >
 <Plus className="w-3 h-3" />
 Apply to selected employees
 </button>
 <button
 type="button"
 onClick={() => void seedDemoWeekFromExistingEmployees()}
 disabled={busy || isPublished || !employees.length}
 className="h-8 rounded border border-neutral-300 px-2 text-xs bg-white inline-flex items-center gap-1 disabled:opacity-50"
 >
 Seed demo week
 </button>
 <button
 type="button"
 onClick={() => void copyPreviousWeek()}
 disabled={busy || isPublished}
 className="h-8 rounded border border-neutral-300 px-2 text-xs bg-white inline-flex items-center gap-1 disabled:opacity-50"
 >
 <Copy className="w-3 h-3" />
 Copy previous week
 </button>
 <div className="ml-auto inline-flex items-center rounded border border-neutral-300 bg-white p-0.5">
 <button
 type="button"
 onClick={() => setPlannerView('timeline')}
 className={`h-7 rounded px-2 text-[11px] ${plannerView === 'timeline' ? 'bg-primary-700 text-white' : 'text-neutral-700'}`}
 >
 Timeline
 </button>
 <button
 type="button"
 onClick={() => setPlannerView('table')}
 className={`h-7 rounded px-2 text-[11px] ${plannerView === 'table' ? 'bg-primary-700 text-white' : 'text-neutral-700'}`}
 >
 Table
 </button>
 </div>
 </div>
 {newAssignment.workDate && weekHolidays.get(newAssignment.workDate) ? (
 <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
 This is {weekHolidays.get(newAssignment.workDate)} - holiday rate (2x) will apply.
 </div>
 ) : null}
 {plannerView === 'table' ? (
 <div className="overflow-auto rounded border border-neutral-200 bg-white">
 <table className="data-table dashboard-data-table w-full text-xs min-w-[900px]">
 <thead className="bg-neutral-50 text-neutral-600">
 <tr>
 <th className="px-2 py-2 w-44">Employee</th>
 {weekDays.map((d) => {
 const total = dayTotals[d] ?? { shifts: 0, hours: 0 };
 return (
 <th key={d} className="col-center px-2 py-2">
 <div>{d}</div>
 {weekHolidays.get(d) ? (
 <div className="text-[10px] font-medium text-amber-700">{weekHolidays.get(d)}</div>
 ) : null}
 <div className="text-[10px] text-neutral-500">
 {total.shifts} shifts, {total.hours.toFixed(1)}h
 </div>
 </th>
 );
 })}
 </tr>
 </thead>
 <tbody>
 {filteredEmployees.map((e) => {
 const selected = bulkEmployeeIds.includes(e.id);
 return (
 <tr key={e.id} className="border-t border-neutral-200 align-top">
 <td className="px-2 py-2">
 <label className="inline-flex items-start gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={selected}
 onChange={(ev) => {
 setBulkEmployeeIds((prev) =>
 ev.target.checked ? [...prev, e.id] : prev.filter((x) => x !== e.id),
 );
 }}
 />
 <span>
 {e.employeeNumber ? `${e.employeeNumber} - ` : ''}
 {e.firstName} {e.lastName}
 </span>
 </label>
 </td>
 {weekDays.map((d) => {
 const cellAssignments = assignmentsByKey.get(`${e.id}|${d}`) ?? [];
 return (
 <td key={`${e.id}-${d}`} className="px-2 py-2 border-l border-neutral-100">
 <div className="space-y-1">
 {cellAssignments.map((a) => {
 const conflictHit = conflicts.some((c) => c.assignmentIds.includes(a.id));
 return (
 <div
 key={a.id}
 className={`rounded border px-2 py-1 ${
 conflictHit ? 'border-amber-300 bg-amber-50' : 'border-neutral-200 bg-neutral-50'
 }`}
 >
 <div className="text-[11px] text-neutral-700">
 {new Date(a.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}-
 {new Date(a.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
 </div>
 <div className="mt-1 flex gap-1">
 <button
 type="button"
 disabled={isPublished}
 onClick={() => {
 setEditingAssignmentId(a.id);
 setEditAssignment({
 employeeId: a.employeeId,
 workDate: toYmd(a.workDate),
 shiftTemplateId: '',
 startTime: new Date(a.startsAt).toISOString().slice(11, 16),
 endTime: new Date(a.endsAt).toISOString().slice(11, 16),
 breakMinutes: a.breakMinutes,
 notes: a.notes || '',
 useTemplate: false,
 });
 }}
 className="rounded border border-neutral-300 px-1 py-0.5 text-[10px] disabled:opacity-50"
 >
 <Pencil className="w-3 h-3" />
 </button>
 <button
 type="button"
 disabled={isPublished}
 onClick={() => void removeAssignment(a.id)}
 className="rounded border border-red-300 px-1 py-0.5 text-[10px] text-red-700 disabled:opacity-50"
 >
 x
 </button>
 </div>
 </div>
 );
 })}
 </div>
 </td>
 );
 })}
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 ) : (
 <div className="max-h-[min(560px,calc(100vh-16rem))] overflow-auto rounded border border-neutral-200 bg-white pb-2 [scrollbar-gutter:stable]">
 <div className="min-w-[calc(14rem+180px*7)]">
 <div className="sticky top-0 z-30 flex border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-600 shadow-[2px_0_0_rgba(0,0,0,0.04)_inset]">
 <div className="sticky left-0 z-40 w-56 shrink-0 border-r border-neutral-200 bg-neutral-50 px-3 py-2 font-medium text-neutral-800">
 Employee
 </div>
 <div className="relative shrink-0" style={{ width: TIMELINE_DAY_WIDTH * 7 }}>
 <div className="flex">
 {weekDays.map((d) => {
 const total = dayTotals[d] ?? { shifts: 0, hours: 0 };
 return (
 <div
 key={`head-${d}`}
 className="border-l border-neutral-200 px-2 py-2"
 style={{ width: TIMELINE_DAY_WIDTH, minWidth: TIMELINE_DAY_WIDTH }}
 >
 <div>{d}</div>
 {weekHolidays.get(d) ? (
 <div className="text-[10px] font-medium text-amber-700">{weekHolidays.get(d)}</div>
 ) : null}
 <div className="text-[10px] text-neutral-500">
 {total.shifts} shifts, {total.hours.toFixed(1)}h
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 {timelineRows.map((row) => {
 const selected = bulkEmployeeIds.includes(row.employee.id);
 const laneH = 28;
 const barH = 24;
 const rowHeight = Math.max(48, row.laneCount * laneH + 10);
 return (
 <div
 key={`timeline-${row.employee.id}`}
 className="flex border-b border-neutral-100 text-xs bg-white"
 >
 <div className="sticky left-0 z-20 w-56 shrink-0 border-r border-neutral-200 bg-white px-3 py-2 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]">
 <label className="inline-flex items-start gap-2 cursor-pointer min-w-0">
 <input
 type="checkbox"
 className="mt-0.5 shrink-0"
 checked={selected}
 onChange={(ev) => {
 setBulkEmployeeIds((prev) =>
 ev.target.checked
 ? [...prev, row.employee.id]
 : prev.filter((x) => x !== row.employee.id),
 );
 }}
 />
 <span className="text-neutral-800 leading-snug break-words">
 {row.employee.employeeNumber ? `${row.employee.employeeNumber} · ` : ''}
 {row.employee.firstName} {row.employee.lastName}
 </span>
 </label>
 </div>
 <div
 className="relative shrink-0 min-w-0"
 style={{ width: TIMELINE_DAY_WIDTH * 7, height: rowHeight }}
 >
 <div className="absolute inset-0 flex pointer-events-none">
 {weekDays.map((d) => (
 <div
 key={`grid-${row.employee.id}-${d}`}
 className="border-l border-neutral-100 bg-neutral-50/40"
 style={{ width: TIMELINE_DAY_WIDTH, minWidth: TIMELINE_DAY_WIDTH }}
 />
 ))}
 </div>
 {row.bars.map((entry) => {
 const a = entry.assignment;
 const conflictHit = conflicts.some((c) => c.assignmentIds.includes(a.id));
 const dayLeft = entry.dayIndex * TIMELINE_DAY_WIDTH;
 const left =
 dayLeft + (entry.startHourOffset / 24) * TIMELINE_DAY_WIDTH + 2;
 const width = Math.max(
 8,
 ((entry.endHourOffset - entry.startHourOffset) / 24) * TIMELINE_DAY_WIDTH - 4,
 );
 const templateColor = a.shiftTemplate?.id
 ? assignmentTemplateColor.get(a.shiftTemplate.id)
 : null;
 const bg = templateColor || (conflictHit ? '#fef3c7' : '#e5e7eb');
 const label = formatShiftRangeCompact(a.startsAt, a.endsAt);
 return (
 <button
 key={`bar-${a.id}`}
 type="button"
 disabled={isPublished}
 onClick={() => {
 setEditingAssignmentId(a.id);
 setEditAssignment({
 employeeId: a.employeeId,
 workDate: toYmd(a.workDate),
 shiftTemplateId: '',
 startTime: new Date(a.startsAt).toISOString().slice(11, 16),
 endTime: new Date(a.endsAt).toISOString().slice(11, 16),
 breakMinutes: a.breakMinutes,
 notes: a.notes || '',
 useTemplate: false,
 });
 }}
 className={`absolute flex items-center justify-center rounded-md border px-1.5 text-center font-medium tabular-nums tracking-tight text-neutral-900 shadow-sm disabled:cursor-default whitespace-nowrap overflow-hidden text-ellipsis ${
 conflictHit ? 'border-amber-400' : 'border-neutral-300/80'
 } ${width < 72 ? 'text-[9px]' : 'text-[10px]'}`}
 style={{
 left,
 width,
 top: 5 + entry.lane * laneH,
 height: barH,
 minWidth: 8,
 backgroundColor: bg,
 }}
 title={`${a.shiftTemplate?.name ? `${a.shiftTemplate.name} · ` : ''}${label}`}
 >
 <span className="truncate max-w-full">{label}</span>
 </button>
 );
 })}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>
 {editingAssignmentId ? (
 <div className="mb-3 rounded border border-primary-200 bg-primary-50 p-3">
 <div className="text-xs font-medium text-primary-800 mb-2">Edit assignment</div>
 <div className="grid gap-2 md:grid-cols-6">
 <input
 type="date"
 value={editAssignment.workDate}
 onChange={(e) => setEditAssignment((s) => ({ ...s, workDate: e.target.value }))}
 className="h-9 rounded border border-neutral-300 px-2 text-sm"
 />
 <input
 type="time"
 value={editAssignment.startTime}
 onChange={(e) => setEditAssignment((s) => ({ ...s, startTime: e.target.value }))}
 className="h-9 rounded border border-neutral-300 px-2 text-sm"
 />
 <input
 type="time"
 value={editAssignment.endTime}
 onChange={(e) => setEditAssignment((s) => ({ ...s, endTime: e.target.value }))}
 className="h-9 rounded border border-neutral-300 px-2 text-sm"
 />
 <input
 type="number"
 value={editAssignment.breakMinutes}
 onChange={(e) =>
 setEditAssignment((s) => ({
 ...s,
 breakMinutes: Math.max(0, parseInt(e.target.value || '0', 10)),
 }))
 }
 className="h-9 rounded border border-neutral-300 px-2 text-sm"
 />
 <input
 value={editAssignment.notes}
 onChange={(e) => setEditAssignment((s) => ({ ...s, notes: e.target.value }))}
 className="h-9 rounded border border-neutral-300 px-2 text-sm md:col-span-2"
 placeholder="Notes"
 />
 </div>
 <div className="flex gap-2 mt-2">
 <button
 type="button"
 disabled={busy || isPublished}
 onClick={() => void updateAssignment(editingAssignmentId, editAssignment)}
 className="h-8 rounded bg-primary-700 text-white px-3 text-xs disabled:opacity-50"
 >
 Save
 </button>
 <button
 type="button"
 onClick={() => setEditingAssignmentId(null)}
 className="h-8 rounded border border-neutral-300 bg-white px-3 text-xs"
 >
 Cancel
 </button>
 </div>
 </div>
 ) : null}
 <details
 key={plannerView}
 className="mt-3 dashboard-surface rounded-lg overflow-hidden"
 open={plannerView === 'table'}
 >
 <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-50 border-b border-neutral-200 list-none [&::-webkit-details-marker]:hidden flex items-center gap-2">
 <span className="text-neutral-400">▸</span>
 Full assignment list (date, template, delete)
 {plannerView === 'timeline' ? (
 <span className="text-[10px] font-normal text-neutral-500">— expand when you need row actions</span>
 ) : null}
 </summary>
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full text-xs min-w-[640px]">
 <thead className="bg-neutral-50 text-neutral-600">
 <tr>
 <th className="col-center px-2 py-2">Date</th>
 <th className="px-2 py-2">Employee</th>
 <th className="col-center px-2 py-2">Shift</th>
 <th className="px-2 py-2">Template</th>
 <th className="col-right px-2 py-2">Actions</th>
 </tr>
 </thead>
 <tbody>
 {assignments.map((a) => (
 <tr key={a.id} className="border-t border-neutral-200">
 <td className="col-center px-2 py-2 tabular-nums whitespace-nowrap">{toYmd(a.workDate)}</td>
 <td className="px-2 py-2">
 {a.employee?.employeeNumber ? `${a.employee.employeeNumber} - ` : ''}
 {a.employee?.firstName} {a.employee?.lastName}
 </td>
 <td className="col-center px-2 py-2 whitespace-nowrap tabular-nums">
 {formatShiftRangeCompact(a.startsAt, a.endsAt)}
 </td>
 <td className="px-2 py-2">{a.shiftTemplate?.name || 'Custom'}</td>
 <td className="col-right px-2 py-2">
 <button
 type="button"
 onClick={() => void removeAssignment(a.id)}
 disabled={isPublished}
 className="rounded border border-red-300 px-2 py-1 text-red-700 disabled:opacity-50"
 >
 Delete
 </button>
 </td>
 </tr>
 ))}
 {!assignments.length ? (
 <tr>
 <td colSpan={5} className="px-2 py-4 text-neutral-500 text-center">
 No assignments in this period yet.
 </td>
 </tr>
 ) : null}
 </tbody>
 </table>
 </div>
 </details>
 </>
 )}
 </div>

 <div className="dashboard-surface shadow-sm p-5">
 <div className="flex items-center gap-2 text-amber-800 font-semibold mb-2">
 <AlertTriangle className="w-5 h-5" />
 Conflict scan
 </div>
 <button
 type="button"
 onClick={() => void scanConflicts()}
 disabled={!selectedPeriodId || busy}
 className="h-9 rounded bg-amber-600 text-white px-3 text-sm disabled:opacity-50"
 >
 Scan selected period
 </button>
 <div className="mt-3 space-y-1 max-h-40 overflow-auto text-xs">
 {!conflicts.length ? (
 <p className="text-neutral-500">No conflicts loaded.</p>
 ) : (
 employees
 .filter((e) => conflictsByEmployee.has(e.id))
 .map((e) => {
 const items = conflictsByEmployee.get(e.id) ?? [];
 return (
 <div key={e.id} className="rounded border border-amber-200 bg-amber-50 px-2 py-1">
 <div className="font-medium text-amber-900">
 {e.employeeNumber ? `${e.employeeNumber} - ` : ''}
 {e.firstName} {e.lastName} ({items.length})
 </div>
 <div className="mt-1 space-y-0.5">
 {items.slice(0, 3).map((c, idx) => (
 <div key={`${c.employeeId}-${idx}`} className="text-amber-800">
 {c.type}: {c.message}
 </div>
 ))}
 {items.length > 3 ? <div className="text-amber-700">+ {items.length - 3} more</div> : null}
 </div>
 </div>
 );
 })
 )}
 </div>
 </div>

 <div className="dashboard-surface shadow-sm p-5">
 <div className="flex items-center gap-2 text-primary-800 font-semibold mb-2">
 <FileSpreadsheet className="w-5 h-5" />
 CSV import
 </div>
 <div className="space-y-2">
 <input
 type="file"
 accept=".csv,text/csv"
 onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
 className="block w-full text-xs"
 />
 <div className="flex flex-wrap gap-2">
 <button
 type="button"
 onClick={() => void previewImport()}
 disabled={!csvFile || !selectedClientId || busy || isPublished}
 className="h-9 rounded border border-neutral-300 px-3 text-sm inline-flex items-center gap-2 disabled:opacity-50"
 >
 <Upload className="w-4 h-4" />
 Preview
 </button>
 <button
 type="button"
 onClick={() => void commitImport()}
 disabled={!csvFile || !selectedClientId || !selectedPeriodId || busy || isPublished}
 className="h-9 rounded bg-primary-700 text-white px-3 text-sm disabled:opacity-50"
 >
 Commit to period
 </button>
 </div>
 {importPreview ? (
 <div className="rounded border border-neutral-200 bg-neutral-50 p-2 text-xs">
 <div>Rows in preview: {importPreview.rows?.length ?? 0}</div>
 <div>Parse errors: {importPreview.parseErrors?.length ?? 0}</div>
 <div>Row errors: {(importPreview.rows ?? []).filter((r) => r.error).length}</div>
 {(importPreview.rows ?? []).filter((r) => r.error).length ? (
 <div className="mt-2 max-h-28 overflow-auto space-y-1">
 {(importPreview.rows ?? [])
 .filter((r) => r.error)
 .slice(0, 8)
 .map((r) => (
 <div key={`preview-err-${r.row}`} className="text-red-700">
 Row {r.row}: {r.error}
 </div>
 ))}
 </div>
 ) : null}
 </div>
 ) : null}
 </div>
 </div>
 </div>

 <div className="mt-4 rounded border border-neutral-200 bg-white p-3">
 <div className="flex items-center justify-between gap-2 mb-2">
 <div className="text-xs font-semibold text-neutral-700">Failed rows retry queue</div>
 <div className="flex gap-2">
 <button
 type="button"
 disabled={!bulkFailures.length || busy || isPublished}
 onClick={() => void retryAllFailures()}
 className="h-7 rounded border border-neutral-300 bg-white px-2 text-xs disabled:opacity-50"
 >
 Retry all
 </button>
 <button
 type="button"
 disabled={!bulkFailures.length}
 onClick={exportFailedRowsCsv}
 className="h-7 rounded border border-neutral-300 bg-white px-2 text-xs disabled:opacity-50"
 >
 Export failed CSV
 </button>
 </div>
 </div>
 {!bulkFailures.length ? (
 <p className="text-xs text-neutral-500">No failed rows queued.</p>
 ) : (
 <div className="max-h-40 overflow-auto space-y-1">
 {bulkFailures.slice(0, 30).map((f) => {
 const emp = employees.find((e) => e.id === f.employeeId);
 return (
 <div key={f.id} className="flex items-center justify-between gap-2 rounded border border-neutral-200 px-2 py-1 text-xs">
 <div>
 <span className="font-medium">{f.source}</span> - {f.workDate} -{' '}
 {emp ? `${emp.employeeNumber ? `${emp.employeeNumber} - ` : ''}${emp.firstName} ${emp.lastName}` : f.employeeId}
 {' '}({f.reason})
 </div>
 <button
 type="button"
 disabled={busy || isPublished}
 onClick={() => void retryFailure(f)}
 className="h-7 rounded border border-neutral-300 bg-white px-2 text-xs disabled:opacity-50"
 >
 Retry
 </button>
 </div>
 );
 })}
 </div>
 )}
 </div>

 <div className="mt-5 text-xs text-neutral-500">
 Rules enforced by API: 8h minimum rest between shifts and 60h maximum net weekly work.
 </div>
 </DashboardPage>
 );
}
