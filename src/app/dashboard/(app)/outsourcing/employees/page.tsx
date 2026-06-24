'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import {
 ChevronDown,
 Download,
 MoreHorizontal,
 Search,
 Trash2,
 Upload,
 UserPlus,
 Users,
 X,
} from 'lucide-react';
import { useEntity } from '@/components/EntitySwitcher';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import EmployeeDirectoryTable from '@/components/dashboard/EmployeeDirectoryTable';

interface EmployeeRecord {
 id: string;
 employeeNumber: string | null;
 firstName: string;
 lastName: string;
 email: string;
 phone: string | null;
 jobTitle: string | null;
 kraPin: string | null;
 nssfNumber: string | null;
 nhifNumber: string | null;
 departmentId: string | null;
 departmentName: string | null;
 clientId: string | null;
 clientName: string | null;
 employmentStatus: string;
 dateOfJoining: string | null;
 bankName: string | null;
 bankBranch: string | null;
 bankAccountNumber: string | null;
 costCenterCode: string | null;
 costCenterName: string | null;
}

type ImportResult = {
 created: number;
 skipped: number;
 errors: number;
 errorDetails?: { row: number; reason: string }[];
};

function profileScoreForRecord(employee: EmployeeRecord) {
  const fields = [
    !!employee.kraPin?.trim(),
    !!employee.nssfNumber?.trim(),
    !!employee.nhifNumber?.trim(),
    !!employee.departmentId,
    !!(employee.bankName?.trim() || employee.bankAccountNumber?.trim()),
  ];
  const done = fields.filter(Boolean).length;
  return { done, total: fields.length, complete: done === fields.length };
}

function EmployeesPageInner() {
 const { activeEntity } = useEntity();
 const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
 const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
 const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
 const [primaryWorkspaceClientId, setPrimaryWorkspaceClientId] = useState('');
 const [clientFilter, setClientFilter] = useState('');

 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [importResult, setImportResult] = useState<ImportResult | null>(null);
 const [importing, setImporting] = useState(false);

 const [departmentFilter, setDepartmentFilter] = useState('');
 const [positionFilter, setPositionFilter] = useState('');
 const [searchQuery, setSearchQuery] = useState('');
 const [presetFilter, setPresetFilter] = useState('all');

 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [bulkDepartmentId, setBulkDepartmentId] = useState('');
 const [bulkAssigning, setBulkAssigning] = useState(false);
 const [bulkDeleting, setBulkDeleting] = useState(false);
 const [bulkSendingPayslips, setBulkSendingPayslips] = useState(false);
 const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
 const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());

 const fileInputRef = useRef<HTMLInputElement>(null);
 const importMenuRef = useRef<HTMLDivElement>(null);
 const [importMenuOpen, setImportMenuOpen] = useState(false);

 const fetchEmployees = async (opts?: { clearLoading?: boolean }) => {
 if (!opts?.clearLoading) setLoading(true);
 setError(null);
 try {
 const params = new URLSearchParams();
 if (departmentFilter.trim()) params.set('departmentId', departmentFilter.trim());
 if (positionFilter.trim()) params.set('jobTitle', positionFilter.trim());
 if (clientFilter.trim()) params.set('clientId', clientFilter.trim());
 if (presetFilter !== 'all') params.set('preset', presetFilter);
 const res = await fetch(`/api/outsourcing/employees?${params.toString()}`);
 const data = await res.json().catch(() => []);
 if (!res.ok) throw new Error(data.error || 'Failed to load employees');
 setEmployees(Array.isArray(data) ? data : []);
 } catch (e) {
 setEmployees([]);
 setError(e instanceof Error ? e.message : 'Failed to load employees');
 } finally {
 if (!opts?.clearLoading) setLoading(false);
 }
 };

 useEffect(() => {
 let cancelled = false;
 const loadWorkspaceAndDepartments = async () => {
 try {
 const res = await fetch('/api/outsourcing/clients');
 const data = await res.json().catch(() => []);
 if (cancelled) return;

 const clientList = Array.isArray(data)
 ? data.map((c: { id: string; name: string }) => ({ id: String(c.id), name: String(c.name) }))
 : [];
 if (!cancelled) setClients(clientList);

 const first = clientList[0] ?? null;
 if (first?.id) {
 setPrimaryWorkspaceClientId(first.id);
 } else {
 setDepartments([]);
 }
 } catch {
 if (!cancelled) setDepartments([]);
 }
 };
 void loadWorkspaceAndDepartments();
 return () => {
 cancelled = true;
 };
 }, [activeEntity.id]);

 useEffect(() => {
 void fetchEmployees();
 }, [departmentFilter, positionFilter, clientFilter, presetFilter, activeEntity.id]);

 useEffect(() => {
 let cancelled = false;
 const clientId = clientFilter || primaryWorkspaceClientId;
 if (!clientId) {
 setDepartments([]);
 return undefined;
 }
 void (async () => {
 try {
 const deptRes = await fetch(`/api/outsourcing/clients/${clientId}/departments`);
 const deptData = await deptRes.json().catch(() => []);
 if (!cancelled) setDepartments(Array.isArray(deptData) ? deptData : []);
 } catch {
 if (!cancelled) setDepartments([]);
 }
 })();
 return () => {
 cancelled = true;
 };
 }, [clientFilter, primaryWorkspaceClientId, activeEntity.id]);

 useEffect(() => {
 setSelectedIds(new Set());
 setBulkDepartmentId('');
 }, [employees]);

 useEffect(() => {
 if (!importMenuOpen) return;
 const onDocClick = (event: MouseEvent) => {
 if (importMenuRef.current && !importMenuRef.current.contains(event.target as Node)) {
 setImportMenuOpen(false);
 }
 };
 document.addEventListener('mousedown', onDocClick);
 return () => document.removeEventListener('mousedown', onDocClick);
 }, [importMenuOpen]);

 const filteredEmployees = useMemo(() => {
 const q = searchQuery.trim().toLowerCase();
 if (!q) return employees;
 return employees.filter((e) => {
 const haystack = [
 `${e.firstName} ${e.lastName}`,
 e.email ?? '',
 e.phone ?? '',
 e.employeeNumber ?? '',
 e.jobTitle ?? '',
 e.departmentName ?? '',
 e.clientName ?? '',
 e.kraPin ?? '',
 e.nssfNumber ?? '',
 e.nhifNumber ?? '',
 e.costCenterCode ?? '',
 e.costCenterName ?? '',
 ]
 .join(' ')
 .toLowerCase();
 return haystack.includes(q);
 });
 }, [employees, searchQuery]);

 const uniquePositions = useMemo(() => {
 const set = new Set<string>();
 employees.forEach((e) => {
 if (e.jobTitle?.trim()) set.add(e.jobTitle.trim());
 });
 return Array.from(set).sort();
 }, [employees]);

 const totals = useMemo(() => {
 const total = filteredEmployees.length;
 const unassigned = filteredEmployees.filter((e) => !e.departmentId).length;
 const depts = new Set(filteredEmployees.filter((e) => e.departmentId).map((e) => e.departmentId as string)).size;
 const incompleteProfiles = filteredEmployees.filter((e) => !profileScoreForRecord(e).complete).length;
 const nonActive = filteredEmployees.filter(
 (e) => e.employmentStatus && !['active', 'probation'].includes(e.employmentStatus),
 ).length;
 return { total, unassigned, depts, incompleteProfiles, nonActive };
 }, [filteredEmployees]);

 const showClientColumn = useMemo(() => {
 const names = new Set(employees.map((e) => e.clientName).filter(Boolean));
 return names.size > 1;
 }, [employees]);

 const hasActiveFilters =
 !!searchQuery.trim() ||
 !!departmentFilter.trim() ||
 !!positionFilter.trim() ||
 !!clientFilter.trim() ||
 presetFilter !== 'all';

 const clearFilters = () => {
 setSearchQuery('');
 setDepartmentFilter('');
 setPositionFilter('');
 setClientFilter('');
 setPresetFilter('all');
 setImportResult(null);
 setSelectedIds(new Set());
 setBulkDepartmentId('');
 };

 const handleDownloadTemplate = () => {
 window.open('/api/outsourcing/employees/template', '_blank');
 };

 const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 e.target.value = '';
 if (!file) return;

 setImporting(true);
 setImportResult(null);
 setError(null);
 try {
 const formData = new FormData();
 formData.append('file', file);
 const res = await fetch('/api/outsourcing/employees/import', {
 method: 'POST',
 body: formData,
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Import failed');
 setImportResult({
 created: data.created ?? 0,
 skipped: data.skipped ?? 0,
 errors: data.errors ?? 0,
 errorDetails: data.errorDetails,
 });
 setDepartmentFilter('');
 setPositionFilter('');
 await fetchEmployees({ clearLoading: true });
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Import failed');
 } finally {
 setImporting(false);
 }
 };

 const toggleSelect = (id: string) => {
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 };

 const toggleSelectAll = () => {
 setSelectedIds((prev) => {
 const allIds = filteredEmployees.map((e) => e.id);
 const allSelected = allIds.length > 0 && allIds.every((id) => prev.has(id));
 return allSelected ? new Set() : new Set(allIds);
 });
 };

 const handleBulkAssignDepartment = async () => {
 if (selectedIds.size === 0) return;
 setBulkAssigning(true);
 setError(null);
 try {
 const res = await fetch('/api/outsourcing/employees/bulk-assign-department', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 employeeIds: Array.from(selectedIds),
 departmentId: bulkDepartmentId || null,
 clientId: clientFilter || primaryWorkspaceClientId || null,
 }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Bulk assignment failed');
 setSelectedIds(new Set());
 setBulkDepartmentId('');
 await fetchEmployees({ clearLoading: true });
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Bulk assignment failed');
 } finally {
 setBulkAssigning(false);
 }
 };

 const handleBulkDelete = async () => {
 if (selectedIds.size === 0) return;
 if (!window.confirm(`Delete ${selectedIds.size} selected employee(s)? This cannot be undone.`)) return;
 setBulkDeleting(true);
 setError(null);
 try {
 const res = await fetch('/api/outsourcing/employees/bulk-delete', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 employeeIds: Array.from(selectedIds),
 clientId: clientFilter || primaryWorkspaceClientId || null,
 }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Bulk delete failed');
 setSelectedIds(new Set());
 await fetchEmployees({ clearLoading: true });
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Bulk delete failed');
 } finally {
 setBulkDeleting(false);
 }
 };

 const handleViewSelectedPayslips = () => {
 if (selectedIds.size === 0) return;
 const params = new URLSearchParams();
 params.set('month', String(payrollMonth));
 params.set('year', String(payrollYear));
 params.set('employeeIds', Array.from(selectedIds).join(','));
 window.open(`/dashboard/payroll/payslips?${params.toString()}`, '_blank');
 };

 const handleSendSelectedPayslips = async () => {
 if (selectedIds.size === 0) return;
 setBulkSendingPayslips(true);
 setError(null);
 try {
 const res = await fetch('/api/outsourcing/payroll/send-payslips', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 month: payrollMonth,
 year: payrollYear,
 employeeIds: Array.from(selectedIds),
 }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to send payslips');
 setImportResult({
 created: data.sent ?? 0,
 skipped: data.skipped ?? 0,
 errors: Array.isArray(data.errors) ? data.errors.length : 0,
 errorDetails: Array.isArray(data.errors)
 ? data.errors.slice(0, 20).map((reason: string, idx: number) => ({ row: idx + 1, reason }))
 : [],
 });
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to send payslips');
 } finally {
 setBulkSendingPayslips(false);
 }
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Employees"
 description="Search, manage, and import staff records."
 actions={
 <Link href="/dashboard/employees/new" className="btn-primary inline-flex shrink-0 items-center gap-2">
 <UserPlus className="h-4 w-4" />
 Add employee
 </Link>
 }
 />

 {error ? (
 <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
 ) : null}

 {importResult ? (
 <div className="rounded-lg border border-primary-200 bg-primary-50/80 px-4 py-3 text-sm">
 <p className="font-medium text-primary-900">Operation complete</p>
 <p className="mt-0.5 text-primary-800">
 Completed: {importResult.created}
 {importResult.skipped > 0 ? ` · Skipped: ${importResult.skipped}` : ''}
 {importResult.errors > 0 ? ` · Errors: ${importResult.errors}` : ''}
 </p>
 {importResult.errorDetails?.length ? (
 <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto text-xs text-amber-900">
 {importResult.errorDetails.map((item, index) => (
 <li key={index}>
 Row {item.row}: {item.reason}
 </li>
 ))}
 </ul>
 ) : null}
 </div>
 ) : null}

 {loading ? (
 <div className="dashboard-surface p-10 shadow-sm">
 <div className="mx-auto max-w-md animate-pulse space-y-3">
 <div className="h-5 w-32 rounded bg-neutral-200" />
 <div className="h-4 w-full rounded bg-neutral-100" />
 <div className="h-4 w-4/5 rounded bg-neutral-100" />
 </div>
 </div>
 ) : (
 <>
 <DashboardStatGrid>
 <DashboardStatCard
 label="In directory"
 value={totals.total}
 hint={hasActiveFilters ? 'Matching current filters' : undefined}
 tone="primary"
 />
 <DashboardStatCard
 label="Unassigned dept"
 value={totals.unassigned}
 hint={totals.unassigned > 0 ? 'Needs department assignment' : undefined}
 tone="warning"
 warn={totals.unassigned > 0}
 />
 <DashboardStatCard
 label="Incomplete profiles"
 value={totals.incompleteProfiles}
 hint={totals.incompleteProfiles > 0 ? 'Missing KRA, NSSF, SHIF, bank, or dept' : undefined}
 tone="violet"
 warn={totals.incompleteProfiles > 0}
 />
 <DashboardStatCard
 label="Departments"
 value={totals.depts}
 hint={totals.nonActive > 0 ? `${totals.nonActive} not active in view` : undefined}
 tone="success"
 />
 </DashboardStatGrid>

 <div className="overflow-hidden dashboard-surface shadow-sm">
 <div className="space-y-4 border-b border-neutral-100 p-4 md:p-5">
 <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
 <div className="relative lg:col-span-3">
 <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
 <input
 type="search"
 placeholder="Search name, email, EMP no…"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="h-10 w-full rounded-lg border border-neutral-200/80 bg-white/90 pl-9 pr-3 text-sm text-ink placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
 />
 </div>
 {clients.length > 1 ? (
 <select
 value={clientFilter}
 onChange={(e) => setClientFilter(e.target.value)}
 className="h-10 rounded-lg border border-neutral-200/80 bg-white/90 px-3 text-sm lg:col-span-2"
 >
 <option value="">All clients</option>
 {clients.map((client) => (
 <option key={client.id} value={client.id}>
 {client.name}
 </option>
 ))}
 </select>
 ) : null}
 <select
 value={departmentFilter}
 onChange={(e) => setDepartmentFilter(e.target.value)}
 className="h-10 rounded-lg border border-neutral-200/80 bg-white/90 px-3 text-sm lg:col-span-2"
 >
 <option value="">All departments</option>
 {departments.map((dept) => (
 <option key={dept.id} value={dept.id}>
 {dept.name}
 </option>
 ))}
 </select>
 <select
 value={positionFilter}
 onChange={(e) => setPositionFilter(e.target.value)}
 className="h-10 rounded-lg border border-neutral-200/80 bg-white/90 px-3 text-sm lg:col-span-2"
 >
 <option value="">All positions</option>
 {uniquePositions.map((position) => (
 <option key={position} value={position}>
 {position}
 </option>
 ))}
 </select>
 <select
 value={presetFilter}
 onChange={(e) => setPresetFilter(e.target.value)}
 className="h-10 rounded-lg border border-neutral-200/80 bg-white/90 px-3 text-sm lg:col-span-2"
 >
 <option value="all">All records</option>
 <option value="incomplete_profile">Incomplete profiles</option>
 <option value="without_manager">No manager</option>
 <option value="without_cost_centre">No cost centre</option>
 <option value="on_probation">On probation</option>
 <option value="suspended">Suspended</option>
 </select>
 </div>

 <div className="flex flex-wrap items-center justify-between gap-3">
 <p className="text-sm text-neutral-500">
 Showing <span className="font-medium text-ink tabular-nums">{filteredEmployees.length}</span> of{' '}
 <span className="tabular-nums">{employees.length}</span>
 </p>
 <div className="flex flex-wrap items-center gap-2">
 {hasActiveFilters ? (
 <button type="button" onClick={clearFilters} className="btn-secondary inline-flex items-center gap-1.5">
 <X className="h-3.5 w-3.5" />
 Clear filters
 </button>
 ) : null}
 <div className="relative" ref={importMenuRef}>
 <button
 type="button"
 onClick={() => setImportMenuOpen((open) => !open)}
 className="btn-secondary inline-flex items-center gap-1.5"
 aria-expanded={importMenuOpen}
 >
 <MoreHorizontal className="h-4 w-4" />
 Import / export
 <ChevronDown className="h-4 w-4 text-neutral-400" />
 </button>
 {importMenuOpen ? (
 <div className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden dashboard-surface rounded-lg py-1 shadow-lg">
 <button
 type="button"
 onClick={() => {
 handleDownloadTemplate();
 setImportMenuOpen(false);
 }}
 className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
 >
 <Download className="h-4 w-4 text-neutral-400" />
 Download template
 </button>
 <button
 type="button"
 onClick={() => {
 fileInputRef.current?.click();
 setImportMenuOpen(false);
 }}
 disabled={importing}
 className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
 >
 <Upload className="h-4 w-4 text-neutral-400" />
 {importing ? 'Importing…' : 'Import Excel'}
 </button>
 </div>
 ) : null}
 </div>
 <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
 </div>
 </div>
 </div>

 {selectedIds.size > 0 ? (
 <div className="border-b border-neutral-100 bg-neutral-50/90 px-4 py-4 md:px-5">
 <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
 <div className="flex flex-wrap items-center gap-3">
 <span className="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-900">
 {selectedIds.size} selected
 </span>
 <button
 type="button"
 onClick={() => {
 setSelectedIds(new Set());
 setBulkDepartmentId('');
 }}
 className="text-sm font-medium text-neutral-600 hover:text-ink"
 >
 Clear selection
 </button>
 </div>

 <div className="grid w-full gap-4 xl:max-w-3xl xl:grid-cols-2">
 <div className="dashboard-surface rounded-lg p-3">
 <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
 Assign department
 </p>
 <div className="flex flex-col gap-2 sm:flex-row">
 <select
 value={bulkDepartmentId}
 onChange={(e) => setBulkDepartmentId(e.target.value)}
 disabled={departments.length === 0}
 className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-200/80 bg-white/90 px-3 text-sm disabled:opacity-60"
 >
 <option value="">Unassigned</option>
 {departments.map((dept) => (
 <option key={dept.id} value={dept.id}>
 {dept.name}
 </option>
 ))}
 </select>
 <button
 type="button"
 onClick={handleBulkAssignDepartment}
 disabled={bulkAssigning}
 className="btn-primary shrink-0 px-4"
 >
 {bulkAssigning ? 'Assigning…' : 'Assign'}
 </button>
 </div>
 </div>

 <div className="dashboard-surface rounded-lg p-3">
 <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Payslips</p>
 <div className="flex flex-col gap-2">
 <div className="flex items-center gap-2">
 <select
 value={payrollMonth}
 onChange={(e) => setPayrollMonth(Number(e.target.value))}
 className="h-9 flex-1 rounded-lg border border-neutral-200/80 bg-white/90 px-2 text-sm"
 >
 {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
 <option key={m} value={m}>
 {new Date(2000, m - 1, 1).toLocaleString(undefined, { month: 'short' })}
 </option>
 ))}
 </select>
 <input
 type="number"
 min={2020}
 max={2035}
 value={payrollYear}
 onChange={(e) => setPayrollYear(parseInt(e.target.value || String(new Date().getFullYear()), 10))}
 className="h-9 w-24 rounded-lg border border-neutral-200/80 bg-white/90 px-2 text-sm tabular-nums"
 />
 </div>
 <div className="flex gap-2">
 <button type="button" onClick={handleViewSelectedPayslips} className="btn-secondary flex-1 text-sm">
 View
 </button>
 <button
 type="button"
 onClick={handleSendSelectedPayslips}
 disabled={bulkSendingPayslips}
 className="btn-primary flex-1 text-sm"
 >
 {bulkSendingPayslips ? 'Sending…' : 'Send'}
 </button>
 </div>
 </div>
 </div>
 </div>

 <button
 type="button"
 onClick={handleBulkDelete}
 disabled={bulkDeleting}
 className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 xl:self-center"
 >
 <Trash2 className="h-4 w-4" />
 {bulkDeleting ? 'Deleting…' : 'Delete'}
 </button>
 </div>
 </div>
 ) : null}

 {employees.length === 0 ? (
 <div className="table-empty-state border-0">
 <Users className="mx-auto mb-3 h-12 w-12 text-neutral-300" />
 <h2 className="text-base font-semibold text-ink">No employees yet</h2>
 <p className="mt-1 max-w-sm text-sm text-neutral-500">
 Add your first employee or import a spreadsheet to populate the directory.
 </p>
 <div className="mt-4 flex flex-wrap justify-center gap-2">
 <Link href="/dashboard/employees/new" className="btn-primary inline-flex items-center gap-2">
 <UserPlus className="h-4 w-4" />
 Add employee
 </Link>
 <button type="button" onClick={handleDownloadTemplate} className="btn-secondary inline-flex items-center gap-2">
 <Download className="h-4 w-4" />
 Template
 </button>
 </div>
 </div>
 ) : filteredEmployees.length === 0 ? (
 <div className="table-empty-state border-0">
 <Search className="mx-auto mb-3 h-12 w-12 text-neutral-300" />
 <h2 className="text-base font-semibold text-ink">No matches</h2>
 <p className="mt-1 text-sm text-neutral-500">Try different search terms or clear your filters.</p>
 {hasActiveFilters ? (
 <button type="button" onClick={clearFilters} className="btn-secondary mt-4">
 Clear filters
 </button>
 ) : null}
 </div>
 ) : (
 <EmployeeDirectoryTable
 employees={filteredEmployees}
 selectedIds={selectedIds}
 onToggleSelect={toggleSelect}
 onToggleSelectAll={toggleSelectAll}
 showClientColumn={showClientColumn}
 />
 )}
 </div>
 </>
 )}
 </DashboardPage>
 );
}

export default function EmployeesPage() {
 return (
 <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-neutral-100" />}>
 <EmployeesPageInner />
 </Suspense>
 );
}

