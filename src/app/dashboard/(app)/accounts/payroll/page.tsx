'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Banknote, FileText, Mail, Loader2, Pencil, Calculator, Search, Upload, Download, AlertTriangle, Eye } from 'lucide-react';
import PayrollEditModal from '@/components/payroll/PayrollEditModal';
import useEntityConfig, { useCurrencyFormatter } from '@/hooks/useEntityConfig';
import { EntityContextBanner } from '@/components/EntityContextBanner';
import { useEntity } from '@/components/EntitySwitcher';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

interface PayrollRecord {
 id: string;
 employeeId: string;
 accountsClientId: string | null;
 accountsClientName: string | null;
 employeeName: string;
 employeeNumber: string | null;
 clientName: string;
 departmentName: string | null;
 month: number;
 year: number;
 basicPay: string;
 grossPay: string;
 paye: string;
 nssf: string;
 nhif: string;
 ahl: string;
 nita?: string;
 netPay: string;
 status: string;
 payrollFrequency?: string;
 period1Gross?: string | null;
 period2Gross?: string | null;
}

interface ClientOption {
 id: string;
 name: string;
}

interface DepartmentOption {
 id: string;
 name: string;
}

interface PayrollImportPreview {
 totals: { parsedRows: number; matched: number; unmatched: number; invalid: number };
 duplicateNationalIds: string[];
 duplicateRows: Array<{
 row: number;
 nationalId: string;
 employeeName: string | null;
 input: { grossPay: number; daysWorked: number | null };
 }>;
 grossBelowBaseRows?: Array<{
 row: number;
 nationalId: string;
 grossPay: number;
 baseSalary: number;
 reason: string;
 }>;
 matchedRows: Array<{ row: number; nationalId: string; employeeId: string; employeeName: string }>;
 unmatchedRows: Array<{ row: number; nationalId: string; employeeName: string | null; email: string | null; reason: string }>;
 invalidRows: Array<{ row: number; reason: string }>;
}

const MONTHS = [
 'January', 'February', 'March', 'April', 'May', 'June',
 'July', 'August', 'September', 'October', 'November', 'December',
];

export default function AccountsPayrollPage() {
 const { activeEntity } = useEntity();
 const entityConfig = useEntityConfig();
 const formatCurrency = useCurrencyFormatter();
 type PendingSendAction =
 | { kind: 'bulk'; employeeIds: string[]; count: number }
 | { kind: 'single'; employeeId: string; employeeName: string };
 const now = new Date();
 const [month, setMonth] = useState(now.getMonth() + 1);
 const [year, setYear] = useState(now.getFullYear());
 const [scope, setScope] = useState<'all' | 'client' | 'department'>('all');
 const [clientId, setClientId] = useState('');
 const [departmentId, setDepartmentId] = useState('');
 const [clients, setClients] = useState<ClientOption[]>([]);
 const [departments, setDepartments] = useState<DepartmentOption[]>([]);
 const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
 const [loading, setLoading] = useState(true);
 const [generating, setGenerating] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [generateResult, setGenerateResult] = useState<string | null>(null);
 const [sendingId, setSendingId] = useState<string | null>(null);
 const [editPayrollId, setEditPayrollId] = useState<string | null>(null);
 const [editEmployeeName, setEditEmployeeName] = useState('');
 const [recalculating, setRecalculating] = useState(false);
 const [selectedPayrollIds, setSelectedPayrollIds] = useState<Set<string>>(new Set());
 const [importingPayrollInput, setImportingPayrollInput] = useState(false);
 const [committingPayrollInput, setCommittingPayrollInput] = useState(false);
 const [selectedPayrollInputFile, setSelectedPayrollInputFile] = useState<File | null>(null);
 const [importPreview, setImportPreview] = useState<PayrollImportPreview | null>(null);
 const [showMissingEmployeesPrompt, setShowMissingEmployeesPrompt] = useState(false);
 const [showDuplicateRowsPrompt, setShowDuplicateRowsPrompt] = useState(false);
 const [showInvalidImportPrompt, setShowInvalidImportPrompt] = useState(false);
 const [duplicateResolution, setDuplicateResolution] = useState<Record<string, number>>({});
 const [acceptSheetValueUpdates, setAcceptSheetValueUpdates] = useState(false);
 const [pendingSendAction, setPendingSendAction] = useState<PendingSendAction | null>(null);
 const [bankExportWarning, setBankExportWarning] = useState<string | null>(null);

 // Table-level filters (search + status)
 const [tableSearchQuery, setTableSearchQuery] = useState('');
 const [statusFilter, setStatusFilter] = useState('');

 const fetchPayrolls = async () => {
 setLoading(true);
 setError(null);
 try {
 const params = new URLSearchParams();
 params.set('month', String(month));
 params.set('year', String(year));
 if (scope === 'client' && clientId.trim()) params.set('clientId', clientId.trim());
 if (scope === 'department' && departmentId.trim()) params.set('departmentId', departmentId.trim());
 const res = await fetch(`/api/outsourcing/payroll?${params}`);
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to load payroll');
 setPayrolls(Array.isArray(data) ? data : []);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to load payroll');
 setPayrolls([]);
 } finally {
 setLoading(false);
 }
 };

 const fetchClients = async () => {
 try {
 const res = await fetch('/api/outsourcing/clients');
 const data = await res.json().catch(() => []);
 if (res.ok && Array.isArray(data)) {
 setClients(data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
 }
 } catch {
 setClients([]);
 }
 };

 const fetchDepartments = async (cid: string) => {
 try {
 const res = await fetch(`/api/outsourcing/clients/${cid}/departments`);
 const data = await res.json().catch(() => []);
 if (res.ok && Array.isArray(data)) {
 setDepartments(data.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })));
 } else {
 setDepartments([]);
 }
 } catch {
 setDepartments([]);
 }
 };

 useEffect(() => {
 fetchClients();
 }, [activeEntity.id]);

 useEffect(() => {
 fetchPayrolls();
 }, [month, year, scope, clientId, departmentId, activeEntity.id]);

 useEffect(() => {
 if (scope === 'department' && clientId.trim()) {
 fetchDepartments(clientId.trim());
 } else {
 setDepartments([]);
 setDepartmentId('');
 }
 }, [scope, clientId]);

 const uniqueStatuses = useMemo(() => {
 const set = new Set<string>();
 payrolls.forEach((p) => {
 if (p.status?.trim()) set.add(p.status.trim());
 });
 return Array.from(set).sort();
 }, [payrolls]);

 const toNumber = (val: string | number | null | undefined): number => {
 const n = typeof val === 'number' ? val : parseFloat(String(val ?? ''));
 return Number.isFinite(n) ? n : 0;
 };

 const filteredPayrolls = useMemo(() => {
 const q = tableSearchQuery.trim().toLowerCase();
 const status = statusFilter.trim().toLowerCase();

 return payrolls.filter((p) => {
 const statusOk = status ? p.status?.toLowerCase() === status : true;
 if (!statusOk) return false;

 if (!q) return true;

 const haystack = [
 p.employeeName,
 p.employeeNumber ?? '',
 p.clientName,
 p.accountsClientName ?? '',
 p.departmentName ?? '',
 p.status,
 ]
 .join(' ')
 .toLowerCase();

 return haystack.includes(q);
 });
 }, [payrolls, tableSearchQuery, statusFilter]);

 const totalsInView = useMemo(() => {
 const records = filteredPayrolls.length;
 const grossTotal = filteredPayrolls.reduce((s, p) => s + toNumber(p.grossPay), 0);
 const netTotal = filteredPayrolls.reduce((s, p) => s + toNumber(p.netPay), 0);
 const paidCount = filteredPayrolls.filter((p) => p.status === 'paid').length;
 const approvedCount = filteredPayrolls.filter((p) => p.status === 'approved').length;
 const draftCount = records - paidCount - approvedCount;
 return { records, grossTotal, netTotal, paidCount, approvedCount, draftCount };
 }, [filteredPayrolls]);

 const hasActiveTableFilters = !!tableSearchQuery.trim() || !!statusFilter.trim();
 const clearTableFilters = () => {
 setTableSearchQuery('');
 setStatusFilter('');
 };
 const selectedRows = useMemo(
 () => filteredPayrolls.filter((p) => selectedPayrollIds.has(p.id)),
 [filteredPayrolls, selectedPayrollIds],
 );
 const selectedEmployeeIds = useMemo(
 () => Array.from(new Set(selectedRows.map((r) => r.employeeId))),
 [selectedRows],
 );
 const duplicateChoicesById = useMemo(() => {
 const map: Record<string, Array<{ row: number; employeeName: string | null; grossPay: number }>> = {};
 const rows = importPreview?.duplicateRows ?? [];
 rows.forEach((r) => {
 if (!map[r.nationalId]) map[r.nationalId] = [];
 map[r.nationalId].push({ row: r.row, employeeName: r.employeeName, grossPay: r.input.grossPay });
 });
 Object.keys(map).forEach((id) => map[id].sort((a, b) => a.row - b.row));
 return map;
 }, [importPreview]);
 const hasDuplicateIds = (importPreview?.duplicateNationalIds?.length ?? 0) > 0;
 const hasResolvedDuplicates = useMemo(() => {
 if (!hasDuplicateIds || !importPreview) return true;
 return importPreview.duplicateNationalIds.every((id) =>
 (duplicateChoicesById[id] ?? []).some((choice) => choice.row === duplicateResolution[id]),
 );
 }, [duplicateChoicesById, duplicateResolution, hasDuplicateIds, importPreview]);
 const onlyGrossBelowBaseInvalid = useMemo(() => {
 if (!importPreview || importPreview.totals.invalid === 0) return false;
 const grossInvalidCount = importPreview.grossBelowBaseRows?.length ?? 0;
 return grossInvalidCount > 0 && grossInvalidCount === importPreview.totals.invalid;
 }, [importPreview]);
 const toggleSelectPayroll = (id: string) => {
 setSelectedPayrollIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 };
 const toggleSelectAllPayrolls = () => {
 const ids = filteredPayrolls.map((p) => p.id);
 setSelectedPayrollIds((prev) => {
 const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
 return allSelected ? new Set() : new Set(ids);
 });
 };
 const handleBulkViewPayslips = () => {
 if (selectedEmployeeIds.length === 0) return;
 const qs = new URLSearchParams({
 month: String(month),
 year: String(year),
 employeeIds: selectedEmployeeIds.join(','),
 });
 window.open(`/dashboard/accounts/payroll/payslips?${qs.toString()}`, '_blank');
 };
 const executeBulkSendPayslips = async (employeeIds: string[]) => {
 if (employeeIds.length === 0) return;
 setError(null);
 try {
 const res = await fetch('/api/outsourcing/payroll/send-payslips', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ month, year, employeeIds }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to send selected payslips');
 setGenerateResult(`Sent ${data.sent ?? 0} payslip(s); skipped ${data.skipped ?? 0}.`);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to send selected payslips');
 }
 };
 const handleBulkSendPayslips = async () => {
 if (selectedEmployeeIds.length === 0) return;
 setPendingSendAction({
 kind: 'bulk',
 employeeIds: [...selectedEmployeeIds],
 count: selectedEmployeeIds.length,
 });
 };

 const handleGenerate = async () => {
 setGenerating(true);
 setGenerateResult(null);
 setError(null);
 try {
 const body: Record<string, unknown> = { month, year };
 if (scope === 'client' && clientId.trim()) body.clientId = clientId.trim();
 if (scope === 'department' && departmentId.trim()) body.departmentId = departmentId.trim();
 const res = await fetch('/api/outsourcing/payroll/generate', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 credentials: 'include',
 body: JSON.stringify(body),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 const hint =
 typeof data.detail === 'string' && data.detail.trim() ? ` ${data.detail}` : '';
 throw new Error((data.error || 'Failed to generate') + hint);
 }
 setGenerateResult(data.message || `Created ${data.created ?? 0} payroll record(s).`);
 await fetchPayrolls();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to generate payroll');
 } finally {
 setGenerating(false);
 }
 };

 const payslipUrl = () => {
 const params = new URLSearchParams();
 params.set('month', String(month));
 params.set('year', String(year));
 if (scope === 'client' && clientId.trim()) params.set('clientId', clientId.trim());
 if (scope === 'department' && departmentId.trim()) params.set('departmentId', departmentId.trim());
 return `/dashboard/accounts/payroll/payslips?${params}`;
 };

 const canGenerate = scope === 'all' || (scope === 'client' && clientId.trim()) || (scope === 'department' && departmentId.trim());
 const canUsePayrollInputImport = !!clientId.trim();

 const runPayrollImportPreview = async (file: File) => {
 setImportingPayrollInput(true);
 setError(null);
 setGenerateResult(null);
 try {
 const formData = new FormData();
 formData.append('file', file);
 formData.append('clientId', clientId.trim());
 formData.append('month', String(month));
 formData.append('year', String(year));
 const res = await fetch('/api/outsourcing/payroll/import/preview', {
 method: 'POST',
 body: formData,
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to preview payroll input.');
 setImportPreview(data as PayrollImportPreview);
 const previewData = data as PayrollImportPreview;
 setAcceptSheetValueUpdates(false);
 setShowInvalidImportPrompt((previewData?.totals?.invalid ?? 0) > 0);
 if ((previewData.duplicateNationalIds?.length ?? 0) > 0) {
 const initialSelection: Record<string, number> = {};
 (previewData.duplicateNationalIds ?? []).forEach((id) => {
 const first = (previewData.duplicateRows ?? []).find((r) => r.nationalId === id);
 if (first) initialSelection[id] = first.row;
 });
 setDuplicateResolution(initialSelection);
 setShowDuplicateRowsPrompt(true);
 } else {
 setDuplicateResolution({});
 setShowDuplicateRowsPrompt(false);
 }
 setShowMissingEmployeesPrompt((data?.totals?.unmatched ?? 0) > 0);
 setGenerateResult(`Preview ready: ${data.totals.matched} matched, ${data.totals.unmatched} unmatched, ${data.totals.invalid} invalid.`);
 } catch (e) {
 setImportPreview(null);
 setShowMissingEmployeesPrompt(false);
 setShowDuplicateRowsPrompt(false);
 setShowInvalidImportPrompt(false);
 setAcceptSheetValueUpdates(false);
 setDuplicateResolution({});
 setError(e instanceof Error ? e.message : 'Failed to preview payroll input.');
 } finally {
 setImportingPayrollInput(false);
 }
 };

 const handlePayrollInputFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 e.target.value = '';
 if (!file) return;
 if (!canUsePayrollInputImport) {
 setError('Select a client first (Scope: client or department) before importing payroll input.');
 return;
 }
 setSelectedPayrollInputFile(file);
 await runPayrollImportPreview(file);
 };

 const handleCreateMissingEmployees = async () => {
 if (!importPreview || !clientId.trim()) return;
 const missingRows = importPreview.unmatchedRows.map((r) => ({
 nationalId: r.nationalId,
 employeeName: r.employeeName,
 email: r.email,
 }));
 if (missingRows.length === 0) return;
 setImportingPayrollInput(true);
 setError(null);
 try {
 const res = await fetch('/api/outsourcing/payroll/import/create-missing-employees', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ clientId: clientId.trim(), missingRows }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to create missing employees.');
 setShowMissingEmployeesPrompt(false);
 setGenerateResult(`Created ${data.createdCount ?? 0} missing employee(s). Re-running preview...`);
 if (selectedPayrollInputFile) await runPayrollImportPreview(selectedPayrollInputFile);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to create missing employees.');
 } finally {
 setImportingPayrollInput(false);
 }
 };

 const handleCommitPayrollImport = async () => {
 if (!selectedPayrollInputFile || !clientId.trim()) return;
 setCommittingPayrollInput(true);
 setError(null);
 try {
 const formData = new FormData();
 formData.append('file', selectedPayrollInputFile);
 formData.append('clientId', clientId.trim());
 formData.append('month', String(month));
 formData.append('year', String(year));
 if (acceptSheetValueUpdates) {
 formData.append('acceptSheetValueUpdates', 'true');
 }
 if (hasDuplicateIds) {
 formData.append('duplicateAction', 'purge');
 formData.append('duplicateResolution', JSON.stringify(duplicateResolution));
 }
 const res = await fetch('/api/outsourcing/payroll/import/commit', {
 method: 'POST',
 body: formData,
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to commit payroll import.');
 setGenerateResult(data.message || 'Payroll import committed.');
 setImportPreview(null);
 setSelectedPayrollInputFile(null);
 setShowMissingEmployeesPrompt(false);
 setShowDuplicateRowsPrompt(false);
 setShowInvalidImportPrompt(false);
 setAcceptSheetValueUpdates(false);
 setDuplicateResolution({});
 await fetchPayrolls();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to commit payroll import.');
 } finally {
 setCommittingPayrollInput(false);
 }
 };

 const executeSingleSendPayslip = async (employeeId: string, employeeName: string) => {
 setSendingId(employeeId);
 try {
 const res = await fetch('/api/outsourcing/payroll/send-payslips', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ month, year, employeeIds: [employeeId] }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to send');
 if (data.errors?.length) {
 setError(data.errors[0] || 'Failed to send payslip');
 } else if (data.sent > 0) {
 setGenerateResult(`Payslip sent to ${employeeName}.`);
 } else if (data.skipped > 0) {
 setError(`${employeeName} has no email on file.`);
 }
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to send payslip');
 } finally {
 setSendingId(null);
 }
 };
 const handleSendPayslip = async (employeeId: string, employeeName: string) => {
 setPendingSendAction({ kind: 'single', employeeId, employeeName });
 };

 const handleRecalculateStatutory = async () => {
 setRecalculating(true);
 setError(null);
 try {
 const body: Record<string, unknown> = { month, year };
 if (scope === 'client' && clientId.trim()) body.clientId = clientId.trim();
 if (scope === 'department' && departmentId.trim()) body.departmentId = departmentId.trim();
 const res = await fetch('/api/outsourcing/payroll/recalculate-statutory', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to recalculate');
 setGenerateResult(data.message || `Recalculated statutory for ${data.updated ?? 0} record(s).`);
 await fetchPayrolls();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to recalculate statutory');
 } finally {
 setRecalculating(false);
 }
 };

 const bankExportState = useMemo(() => {
 if (payrolls.length === 0) return { enabled: false, title: 'No payroll records to export.' as const };
 if (payrolls.some((p) => p.status === 'draft')) {
 return { enabled: false, title: 'Approve the payroll run before exporting.' as const };
 }
 if (!payrolls.every((p) => p.status === 'approved' || p.status === 'paid')) {
 return { enabled: false, title: 'All visible payroll records must be approved or paid before exporting.' as const };
 }
 return { enabled: true, title: 'Download CSV for bank batch payment (net pay)' as const };
 }, [payrolls]);

 const handleBankExport = async () => {
 if (!bankExportState.enabled) return;
 setBankExportWarning(null);
 setError(null);
 try {
 const params = new URLSearchParams();
 params.set('month', String(month));
 params.set('year', String(year));
 if (scope === 'client' && clientId.trim()) params.set('clientId', clientId.trim());
 if (scope === 'department' && departmentId.trim()) params.set('departmentId', departmentId.trim());
 const res = await fetch(`/api/outsourcing/payroll/bank-export?${params.toString()}`, { credentials: 'include' });
 const miss = parseInt(res.headers.get('X-Missing-Bank-Details-Count') || '0', 10);
 if (!res.ok) {
 const data = await res.json().catch(() => ({}));
 throw new Error((data as { error?: string }).error || 'Bank export failed');
 }
 const blob = await res.blob();
 const cd = res.headers.get('Content-Disposition');
 const match = cd?.match(/filename="([^"]+)"/);
 const filename = match?.[1] ?? `payroll-${year}-${String(month).padStart(2, '0')}-bank-export.csv`;
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 a.rel = 'noopener';
 document.body.appendChild(a);
 a.click();
 a.remove();
 URL.revokeObjectURL(url);
 if (miss > 0) {
 setBankExportWarning(
 `${miss} employee(s) are missing bank name or account number and may need manual payment.`,
 );
 }
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Bank export failed');
 }
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 title={entityConfig.payroll.runLabel}
 description={
 <>
 <EntityContextBanner />
 Generate payroll and payslips by month. Scope by all employees, client, or department.
 </>
 }
 />

 {error && (
 <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
 {error}
 </div>
 )}

 {generateResult && (
 <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-lg text-primary-800 text-sm flex items-center justify-between">
 <span>{generateResult}</span>
 <button type="button" onClick={() => setGenerateResult(null)} className="text-primary-600 hover:underline">
 Dismiss
 </button>
 </div>
 )}

 {bankExportWarning && (
 <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm flex items-center justify-between gap-3">
 <span>{bankExportWarning}</span>
 <button type="button" onClick={() => setBankExportWarning(null)} className="text-amber-800 hover:underline shrink-0">
 Dismiss
 </button>
 </div>
 )}

 <div className="dashboard-surface shadow-sm p-4 sm:p-6 mb-6">
 <h2 className="text-base font-semibold text-primary-900 mb-4 flex items-center gap-2">
 <Banknote className="w-5 h-5 text-primary-600" />
 {entityConfig.payroll.runLabel} run
 </h2>
 <div className="flex flex-wrap gap-4 items-end">
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Month</label>
 <select
 value={month}
 onChange={(e) => setMonth(parseInt(e.target.value, 10))}
 className="px-4 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500"
 >
 {MONTHS.map((m, i) => (
 <option key={i} value={i + 1}>{m}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Year</label>
 <input
 type="number"
 value={year}
 onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
 min={2020}
 max={2030}
 className="px-4 py-2 border border-neutral-300 rounded-lg text-sm w-24 focus:ring-2 focus:ring-primary-500"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Scope</label>
 <select
 value={scope}
 onChange={(e) => setScope(e.target.value as 'all' | 'client' | 'department')}
 className="px-4 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500"
 >
 <option value="all">All employees</option>
 <option value="client">By client</option>
 <option value="department">By department</option>
 </select>
 </div>
 {scope === 'client' && (
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Client</label>
 <select
 value={clientId}
 onChange={(e) => setClientId(e.target.value)}
 className="px-4 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 min-w-[200px]"
 >
 <option value="">Select client</option>
 {clients.map((c) => (
 <option key={c.id} value={c.id}>{c.name}</option>
 ))}
 </select>
 </div>
 )}
 {scope === 'department' && (
 <>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Client</label>
 <select
 value={clientId}
 onChange={(e) => { setClientId(e.target.value); setDepartmentId(''); }}
 className="px-4 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 min-w-[200px]"
 >
 <option value="">Select client</option>
 {clients.map((c) => (
 <option key={c.id} value={c.id}>{c.name}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Department</label>
 <select
 value={departmentId}
 onChange={(e) => setDepartmentId(e.target.value)}
 disabled={!clientId.trim()}
 className="px-4 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 min-w-[180px] disabled:opacity-50"
 >
 <option value="">Select department</option>
 {departments.map((d) => (
 <option key={d.id} value={d.id}>{d.name}</option>
 ))}
 </select>
 </div>
 </>
 )}
 <div className="flex gap-2">
 <button
 type="button"
 onClick={handleGenerate}
 disabled={!canGenerate || generating}
 className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {generating ? 'Generating…' : 'Generate payroll'}
 </button>
 <Link
 href={payslipUrl()}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
 >
 <FileText className="w-4 h-4" />
 View payslips
 </Link>
 <button
 type="button"
 onClick={handleRecalculateStatutory}
 disabled={payrolls.length === 0 || recalculating}
 title={`Recalculate ${entityConfig.payroll.statutoryItems.map((i) => i.badge).join(', ')} for all in scope`}
 className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {recalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
 Recalculate statutory (all)
 </button>
 <button
 type="button"
 onClick={handleBankExport}
 disabled={!bankExportState.enabled}
 title={bankExportState.title}
 className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <Download className="w-4 h-4" />
 Download bank file
 </button>
 </div>
 </div>
 <div className="mt-4 pt-4 border-t border-neutral-100">
 <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
 Payroll input template import
 </p>
 <p className="text-sm text-neutral-600 mb-3">
 Download the payroll-input template, fill it, preview matches by National ID, then commit to create/update draft payroll records.
 </p>
 <div className="flex flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={() => {
 if (!canUsePayrollInputImport) {
 setError('Select a client first (Scope: client or department) to download/import payroll input.');
 return;
 }
 window.open(
 `/api/outsourcing/employees/template?mode=payroll-input&clientId=${encodeURIComponent(clientId.trim())}`,
 '_blank',
 );
 }}
 className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
 >
 <Download className="w-4 h-4" />
 Download payroll template
 </button>
 <input
 id="accounts-payroll-input-import-file"
 type="file"
 accept=".xlsx,.xls"
 className="hidden"
 onChange={handlePayrollInputFileSelected}
 />
 <button
 type="button"
 disabled={!canUsePayrollInputImport || importingPayrollInput}
 onClick={() => {
 const el = document.getElementById('accounts-payroll-input-import-file') as HTMLInputElement | null;
 el?.click();
 }}
 className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <Upload className="w-4 h-4" />
 {importingPayrollInput ? 'Previewing…' : 'Upload & preview'}
 </button>
 {importPreview && (
 <button
 type="button"
 disabled={
 committingPayrollInput ||
 (importPreview.totals.invalid > 0 && !acceptSheetValueUpdates) ||
 importPreview.totals.unmatched > 0 ||
 (importPreview.duplicateNationalIds.length > 0 && !hasResolvedDuplicates) ||
 importPreview.totals.matched === 0
 }
 onClick={handleCommitPayrollImport}
 className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {committingPayrollInput ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
 Commit import
 </button>
 )}
 </div>
 </div>
 </div>

 <div className="dashboard-surface shadow-sm overflow-hidden">
 <h2 className="text-base font-semibold text-primary-900 px-4 sm:px-6 py-4 border-b border-neutral-100">
 Payroll records ({month}/{year})
 </h2>
 {loading ? (
 <div className="p-8 animate-pulse">
 <div className="h-4 bg-neutral-100 rounded w-full mb-4" />
 <div className="h-4 bg-neutral-100 rounded w-5/6 mb-4" />
 <div className="h-4 bg-neutral-100 rounded w-4/6" />
 </div>
 ) : payrolls.length === 0 ? (
 <div className="p-8 text-center text-neutral-500 text-sm">
 No payroll records for this period. Use &quot;Generate payroll&quot; to create draft records for employees in scope.
 </div>
 ) : (
 <>
 <div className="px-4 sm:px-6 py-4 border-b border-neutral-100">
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
 <div className="dashboard-stat-card">
 <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Records in view</p>
 <p className="text-2xl font-bold text-primary-900 tabular-nums">{totalsInView.records}</p>
 </div>
 <div className="dashboard-stat-card">
 <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Total gross</p>
 <p className="text-2xl font-bold text-primary-700 tabular-nums">
 {formatCurrency(totalsInView.grossTotal)}
 </p>
 </div>
 <div className="dashboard-stat-card">
 <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Total net</p>
 <p className="text-2xl font-bold text-emerald-700 tabular-nums">
 {formatCurrency(totalsInView.netTotal)}
 </p>
 </div>
 <div className="dashboard-stat-card">
 <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Status</p>
 <p className="text-sm text-neutral-700">
 Paid: <span className="font-semibold text-emerald-700 tabular-nums">{totalsInView.paidCount}</span> · Approved:{' '}
 <span className="font-semibold text-blue-700 tabular-nums">{totalsInView.approvedCount}</span>
 </p>
 <p className="text-xs text-neutral-500 mt-1 tabular-nums">Draft: {totalsInView.draftCount}</p>
 </div>
 </div>

 <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
 <div className="relative max-w-xs">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
 <input
 type="search"
 placeholder="Search employee, client, dept, status…"
 value={tableSearchQuery}
 onChange={(e) => setTableSearchQuery(e.target.value)}
 className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
 aria-label="Search payroll table"
 />
 </div>
 <div className="flex items-center gap-3 flex-wrap">
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className="px-4 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500"
 aria-label="Filter by status"
 >
 <option value="">All statuses</option>
 {uniqueStatuses.map((s) => (
 <option key={s} value={s}>
 {s}
 </option>
 ))}
 </select>
 {hasActiveTableFilters && (
 <button
 type="button"
 onClick={clearTableFilters}
 className="inline-flex items-center justify-center px-4 py-2 dashboard-surface rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
 >
 Clear table filters
 </button>
 )}
 {selectedPayrollIds.size > 0 && (
 <>
 <span className="text-sm text-neutral-600">{selectedPayrollIds.size} selected</span>
 <button
 type="button"
 onClick={handleBulkViewPayslips}
 className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-primary-200 bg-white text-primary-800 text-sm font-semibold hover:bg-primary-50"
 >
 <Eye className="w-4 h-4" />
 View selected payslips
 </button>
 <button
 type="button"
 onClick={handleBulkSendPayslips}
 className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-primary-200 bg-primary-50 text-primary-800 text-sm font-semibold hover:bg-primary-100"
 >
 <Mail className="w-4 h-4" />
 Send selected payslips
 </button>
 </>
 )}
 </div>
 </div>
 </div>

 <div className="overflow-x-auto">
 {filteredPayrolls.length === 0 ? (
 <div className="p-8 text-center text-neutral-500 text-sm">
 No payroll records match your search/filters.
 </div>
 ) : (
 <table className="data-table dashboard-data-table w-full min-w-[720px] text-sm">
 <thead>
 <tr className="dashboard-toolbar">
 <th className="w-10 px-4 py-3">
 <input
 type="checkbox"
 checked={filteredPayrolls.length > 0 && filteredPayrolls.every((p) => selectedPayrollIds.has(p.id))}
 onChange={toggleSelectAllPayrolls}
 className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
 aria-label="Select all payroll rows"
 />
 </th>
 <th className="text-left px-4 py-3 font-medium text-neutral-600">Employee</th>
 <th className="text-left px-4 py-3 font-medium text-neutral-600">Client</th>
 <th className="text-left px-4 py-3 font-medium text-neutral-600">Billing profile</th>
 <th className="text-left px-4 py-3 font-medium text-neutral-600">Dept</th>
 <th className="text-right px-4 py-3 font-medium text-neutral-600">Basic</th>
 <th className="text-right px-4 py-3 font-medium text-neutral-600">Gross</th>
 <th className="text-right px-4 py-3 font-medium text-neutral-600">
 {entityConfig.payroll.deductionColumnHeaders.paye}
 </th>
 <th className="text-right px-4 py-3 font-medium text-neutral-600">
 {entityConfig.payroll.deductionColumnHeaders.nssf}
 </th>
 <th className="text-right px-4 py-3 font-medium text-neutral-600">
 {entityConfig.payroll.deductionColumnHeaders.nhif}
 </th>
 <th className="text-right px-4 py-3 font-medium text-neutral-600">
 {entityConfig.payroll.deductionColumnHeaders.ahl}
 </th>
 <th
 className="text-right px-4 py-3 font-medium text-neutral-600"
 title="Employer levy (not from net pay)"
 >
 {entityConfig.payroll.deductionColumnHeaders.nita}
 </th>
 <th className="text-right px-4 py-3 font-medium text-neutral-600">Net pay</th>
 <th className="text-left px-4 py-3 font-medium text-neutral-600">Status</th>
 <th className="w-10 px-4 py-3 text-center font-medium text-neutral-600">Edit</th>
 <th className="w-10 px-4 py-3 text-right font-medium text-neutral-600">Payslip</th>
 </tr>
 </thead>
 <tbody>
 {filteredPayrolls.map((p) => (
 <tr key={p.id} className="border-b border-neutral-100 transition-colors">
 <td className="px-4 py-3">
 <input
 type="checkbox"
 checked={selectedPayrollIds.has(p.id)}
 onChange={() => toggleSelectPayroll(p.id)}
 className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
 aria-label={`Select ${p.employeeName}`}
 />
 </td>
 <td className="px-4 py-3">
 <span className="font-medium text-primary-900">{p.employeeName}</span>
 {p.employeeNumber && (
 <span className="block text-xs text-neutral-500">{p.employeeNumber}</span>
 )}
 </td>
 <td className="px-4 py-3 text-neutral-600">
 {p.clientName}
 {p.payrollFrequency === 'biweekly' && (
 <span className="ml-1 text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-1 rounded">2wk</span>
 )}
 </td>
 <td className="px-4 py-3 text-neutral-600">
 {p.accountsClientId && p.accountsClientName ? (
 <Link
 href={`/dashboard/accounts/clients/${p.accountsClientId}`}
 className="text-primary-700 hover:text-primary-900 hover:underline text-xs font-medium"
 title="Open billing client profile"
 >
 {p.accountsClientName}
 </Link>
 ) : (
 <span className="text-neutral-400 text-xs">No linked profile</span>
 )}
 </td>
 <td className="px-4 py-3 text-neutral-600">{p.departmentName ?? '—'}</td>
 <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(p.basicPay))}</td>
 <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(p.grossPay))}</td>
 <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(p.paye))}</td>
 <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(p.nssf))}</td>
 <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(p.nhif))}</td>
 <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(p.ahl ?? 0))}</td>
 <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
 {formatCurrency(Number(p.nita ?? 0))}
 </td>
 <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(Number(p.netPay))}</td>
 <td className="px-4 py-3">
 <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
 p.status === 'paid'
 ? 'bg-emerald-50 text-emerald-700'
 : p.status === 'approved'
 ? 'bg-blue-50 text-blue-700'
 : 'bg-amber-50 text-amber-700'
 }`}>
 {p.status}
 </span>
 </td>
 <td className="px-4 py-3 text-center">
 <button
 type="button"
 onClick={() => {
 setEditPayrollId(p.id);
 setEditEmployeeName(p.employeeName);
 }}
 title={`Edit pay for ${p.employeeName}`}
 className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-neutral-600 hover:bg-primary-50 hover:text-primary-700 transition-colors"
 >
 <Pencil className="w-4 h-4" />
 </button>
 </td>
 <td className="px-4 py-3 text-right whitespace-nowrap">
 <Link
 href={`/dashboard/accounts/payroll/payslips?month=${month}&year=${year}&employeeIds=${encodeURIComponent(p.employeeId)}`}
 title={`View payslip for ${p.employeeName}`}
 className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-neutral-600 hover:bg-primary-50 hover:text-primary-700 transition-colors mr-1"
 >
 <Eye className="w-4 h-4" />
 </Link>
 <button
 type="button"
 onClick={() => handleSendPayslip(p.employeeId, p.employeeName)}
 disabled={sendingId === p.employeeId}
 title={`Send payslip for ${MONTHS[month - 1]} ${year} to ${p.employeeName}`}
 className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-neutral-600 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 {sendingId === p.employeeId ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Mail className="w-4 h-4" />
 )}
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>
 </>
 )}
 </div>

 {editPayrollId && (
 <PayrollEditModal
 payrollId={editPayrollId}
 employeeName={editEmployeeName}
 month={month}
 year={year}
 onClose={() => { setEditPayrollId(null); setEditEmployeeName(''); }}
 onSaved={fetchPayrolls}
 />
 )}
 {showMissingEmployeesPrompt && importPreview && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
 <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg border border-neutral-200 p-5 sm:p-6">
 <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
 <AlertTriangle className="w-5 h-5 text-amber-600" />
 Add missing employees?
 </h3>
 <p className="text-sm text-neutral-600 mt-1">
 {importPreview.totals.unmatched} row(s) have National IDs not found in this client. Create these employees now, then continue payroll import?
 </p>
 <ul className="mt-3 text-sm text-neutral-700 list-disc list-inside space-y-1 max-h-48 overflow-auto">
 {importPreview.unmatchedRows.slice(0, 20).map((r, idx) => (
 <li key={`${r.nationalId}-${idx}`}>
 Row {r.row}: {r.employeeName || 'Unnamed'} · ID {r.nationalId}
 </li>
 ))}
 </ul>
 <div className="mt-5 flex items-center justify-end gap-2">
 <button
 type="button"
 className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-800 hover:bg-neutral-50"
 onClick={() => setShowMissingEmployeesPrompt(false)}
 disabled={importingPayrollInput}
 >
 Continue without them
 </button>
 <button
 type="button"
 className="px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800 disabled:opacity-50 inline-flex items-center gap-2"
 onClick={handleCreateMissingEmployees}
 disabled={importingPayrollInput}
 >
 {importingPayrollInput ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
 Create missing employees
 </button>
 </div>
 </div>
 </div>
 )}
 {showDuplicateRowsPrompt && importPreview && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
 <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg border border-neutral-200 p-5 sm:p-6">
 <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
 <AlertTriangle className="w-5 h-5 text-amber-600" />
 Resolve duplicate National IDs
 </h3>
 <p className="text-sm text-neutral-600 mt-1">
 Choose the correct row for each duplicate National ID. You can then purge duplicate rows during commit, or re-upload a corrected sheet.
 </p>
 <div className="mt-4 space-y-3 max-h-64 overflow-auto">
 {importPreview.duplicateNationalIds.map((id) => (
 <div key={id} className="border border-neutral-200 rounded-lg p-3">
 <p className="text-sm font-semibold text-neutral-900">National ID: {id}</p>
 <select
 value={duplicateResolution[id] ?? ''}
 onChange={(e) => setDuplicateResolution((prev) => ({ ...prev, [id]: Number(e.target.value) }))}
 className="mt-2 w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500"
 >
 <option value="">Select correct row</option>
 {(duplicateChoicesById[id] ?? []).map((choice) => (
 <option key={`${id}-${choice.row}`} value={choice.row}>
 Row {choice.row} - {choice.employeeName || 'Unnamed'} - Gross {Number(choice.grossPay).toLocaleString()}
 </option>
 ))}
 </select>
 </div>
 ))}
 </div>
 <div className="mt-5 flex items-center justify-end gap-2">
 <button
 type="button"
 className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-800 hover:bg-neutral-50"
 onClick={() => {
 setShowDuplicateRowsPrompt(false);
 setGenerateResult('Re-upload a corrected sheet to remove duplicate National IDs, or keep your selections and commit to purge duplicates.');
 }}
 >
 Re-upload corrected sheet
 </button>
 <button
 type="button"
 className="px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800 disabled:opacity-50"
 onClick={() => setShowDuplicateRowsPrompt(false)}
 disabled={!hasResolvedDuplicates}
 >
 Purge duplicates and continue
 </button>
 </div>
 </div>
 </div>
 )}
 {showInvalidImportPrompt && importPreview && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
 <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg border border-neutral-200 p-5 sm:p-6">
 <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
 <AlertTriangle className="w-5 h-5 text-amber-600" />
 Invalid payroll values found
 </h3>
 <p className="text-sm text-neutral-600 mt-1">
 {importPreview.totals.invalid} row(s) are invalid. Update the values in your sheet and re-upload, or discard this upload attempt.
 </p>
 <ul className="mt-3 text-sm text-neutral-700 list-disc list-inside space-y-1 max-h-48 overflow-auto">
 {importPreview.invalidRows.slice(0, 20).map((r, idx) => (
 <li key={`${r.row}-${idx}`}>
 Row {r.row}: {r.reason}
 </li>
 ))}
 </ul>
 <div className="mt-5 flex items-center justify-end gap-2">
 <button
 type="button"
 className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-800 hover:bg-neutral-50"
 onClick={() => {
 setShowInvalidImportPrompt(false);
 if (onlyGrossBelowBaseInvalid) {
 setAcceptSheetValueUpdates(true);
 setGenerateResult('Sheet values accepted. Commit import to update base salary from sheet values where needed.');
 return;
 }
 setGenerateResult('Please update invalid values in the sheet, then re-upload and preview again.');
 }}
 >
 {onlyGrossBelowBaseInvalid ? 'Accept sheet values and update database' : 'Update values and re-upload'}
 </button>
 <button
 type="button"
 className="px-4 py-2 rounded-lg bg-neutral-800 text-white hover:bg-neutral-700"
 onClick={() => {
 setImportPreview(null);
 setSelectedPayrollInputFile(null);
 setShowMissingEmployeesPrompt(false);
 setShowDuplicateRowsPrompt(false);
 setShowInvalidImportPrompt(false);
 setAcceptSheetValueUpdates(false);
 setDuplicateResolution({});
 setGenerateResult('Upload discarded.');
 }}
 >
 Discard upload attempt
 </button>
 </div>
 </div>
 </div>
 )}
 {pendingSendAction && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
 <div className="w-full max-w-lg bg-white rounded-xl shadow-lg border border-neutral-200 p-5 sm:p-6">
 <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
 <AlertTriangle className="w-5 h-5 text-amber-600" />
 Confirm sending payslips
 </h3>
 <p className="text-sm text-neutral-600 mt-1">
 {pendingSendAction.kind === 'bulk'
 ? `Send payslips for ${pendingSendAction.count} selected employee(s) for ${MONTHS[month - 1]} ${year}?`
 : `Send payslip for ${pendingSendAction.employeeName} (${MONTHS[month - 1]} ${year}) now?`}
 </p>
 <div className="mt-5 flex items-center justify-end gap-2">
 <button
 type="button"
 className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-800 hover:bg-neutral-50"
 onClick={() => setPendingSendAction(null)}
 >
 Cancel
 </button>
 <button
 type="button"
 className="px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800 inline-flex items-center gap-2"
 onClick={async () => {
 const action = pendingSendAction;
 setPendingSendAction(null);
 if (action.kind === 'bulk') {
 await executeBulkSendPayslips(action.employeeIds);
 return;
 }
 await executeSingleSendPayslip(action.employeeId, action.employeeName);
 }}
 >
 Confirm send
 </button>
 </div>
 </div>
 </div>
 )}
 </DashboardPage>
 );
}
