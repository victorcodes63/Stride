'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Banknote, FileText, Mail, Loader2, Pencil, Calculator, Upload, Download, AlertTriangle, Eye } from 'lucide-react';
import PayrollEditModal from '@/components/payroll/PayrollEditModal';
import useEntityConfig, { useCurrencyFormatter } from '@/hooks/useEntityConfig';
import { EntityContextBanner } from '@/components/EntityContextBanner';
import { useEntity } from '@/components/EntitySwitcher';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

interface PayrollRecord {
 id: string;
 employeeId: string;
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

interface DepartmentOption {
 id: string;
 name: string;
}

interface PayrollImportPreview {
 totals: { parsedRows: number; matched: number; unmatched: number; invalid: number };
 duplicateNationalIds: string[];
 matchedRows: Array<{
 row: number;
 nationalId: string;
 employeeId: string;
 employeeName: string;
 employeeEmail: string;
 input: {
 daysWorked: number | null;
 incentives: number;
 allowances: number;
 overtime: number;
 holidayPay: number;
 leavePay: number;
 grossPay: number;
 };
 }>;
 unmatchedRows: Array<{
 row: number;
 nationalId: string;
 employeeName: string | null;
 email: string | null;
 reason: string;
 }>;
 invalidRows: Array<{ row: number; reason: string }>;
}

const MONTHS = [
 'January', 'February', 'March', 'April', 'May', 'June',
 'July', 'August', 'September', 'October', 'November', 'December',
];

export default function OutsourcingPayrollPage() {
 const { activeEntity } = useEntity();
 const entityConfig = useEntityConfig();
 const formatCurrency = useCurrencyFormatter();
 const now = new Date();
 const [month, setMonth] = useState(now.getMonth() + 1);
 const [year, setYear] = useState(now.getFullYear());
 const [scope, setScope] = useState<'all' | 'department'>('all');
 const [clientId, setClientId] = useState('');
 const [departmentId, setDepartmentId] = useState('');
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
 const [importingPayrollInput, setImportingPayrollInput] = useState(false);
 const [committingPayrollInput, setCommittingPayrollInput] = useState(false);
 const [selectedPayrollInputFile, setSelectedPayrollInputFile] = useState<File | null>(null);
 const [importPreview, setImportPreview] = useState<PayrollImportPreview | null>(null);
 const [showMissingEmployeesPrompt, setShowMissingEmployeesPrompt] = useState(false);
 const [pendingSendPayslip, setPendingSendPayslip] = useState<{ employeeId: string; employeeName: string } | null>(null);
 const [bankExportWarning, setBankExportWarning] = useState<string | null>(null);

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

 const fetchPayrolls = async () => {
 setLoading(true);
 setError(null);
 try {
 const params = new URLSearchParams();
 params.set('month', String(month));
 params.set('year', String(year));
 if (clientId.trim()) params.set('clientId', clientId.trim());
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
 fetch('/api/outsourcing/clients')
 .then((r) => r.json())
 .then((data) => {
 if (Array.isArray(data) && data[0]?.id) {
 const id = String(data[0].id);
 setClientId(id);
 void fetchDepartments(id);
 }
 })
 .catch(() => {});
 }, [activeEntity.id]);

 useEffect(() => {
 fetchPayrolls();
 }, [month, year, scope, clientId, departmentId, activeEntity.id]);

 useEffect(() => {
 if (clientId.trim()) {
 fetchDepartments(clientId.trim());
 } else {
 setDepartments([]);
 setDepartmentId('');
 }
 }, [clientId]);

 const handleGenerate = async () => {
 setGenerating(true);
 setGenerateResult(null);
 setError(null);
 try {
 const body: Record<string, unknown> = { month, year };
 if (clientId.trim()) body.clientId = clientId.trim();
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
 typeof data.detail === 'string' && data.detail.trim()
 ? ` ${data.detail}`
 : '';
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
 if (clientId.trim()) params.set('clientId', clientId.trim());
 if (scope === 'department' && departmentId.trim()) params.set('departmentId', departmentId.trim());
 return `/dashboard/payroll/payslips?${params}`;
 };

 const canGenerate = scope === 'all' || (scope === 'department' && departmentId.trim());

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
 setShowMissingEmployeesPrompt((data?.totals?.unmatched ?? 0) > 0);
 setGenerateResult(`Preview ready: ${data.totals.matched} matched, ${data.totals.unmatched} unmatched, ${data.totals.invalid} invalid.`);
 } catch (e) {
 setImportPreview(null);
 setShowMissingEmployeesPrompt(false);
 setError(e instanceof Error ? e.message : 'Failed to preview payroll input.');
 } finally {
 setImportingPayrollInput(false);
 }
 };

 const handlePayrollInputFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 e.target.value = '';
 if (!file) return;
 setSelectedPayrollInputFile(file);
 await runPayrollImportPreview(file);
 };

 const handleCreateMissingEmployees = async () => {
 if (!importPreview) return;
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
 body: JSON.stringify({ clientId: clientId.trim() || null, missingRows }),
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
 if (!selectedPayrollInputFile) return;
 setCommittingPayrollInput(true);
 setError(null);
 try {
 const formData = new FormData();
 formData.append('file', selectedPayrollInputFile);
 if (clientId.trim()) formData.append('clientId', clientId.trim());
 formData.append('month', String(month));
 formData.append('year', String(year));
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
 await fetchPayrolls();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to commit payroll import.');
 } finally {
 setCommittingPayrollInput(false);
 }
 };

 const executeSendPayslip = async (employeeId: string, employeeName: string) => {
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
 setPendingSendPayslip({ employeeId, employeeName });
 };

 const handleBankExport = async () => {
 if (!bankExportState.enabled) return;
 setBankExportWarning(null);
 setError(null);
 try {
 const params = new URLSearchParams();
 params.set('month', String(month));
 params.set('year', String(year));
 if (clientId.trim()) params.set('clientId', clientId.trim());
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

 const handleRecalculateStatutory = async () => {
 setRecalculating(true);
 setError(null);
 try {
 const body: Record<string, unknown> = { month, year };
 if (clientId.trim()) body.clientId = clientId.trim();
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

 return (
 <DashboardPage>
 <DashboardPageHeader
 title={entityConfig.payroll.runLabel}
 description="Generate payroll and payslips by month for your workforce."
 />
 <EntityContextBanner />

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
 onChange={(e) => setScope(e.target.value as 'all' | 'department')}
 className="px-4 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500"
 >
 <option value="all">All employees</option>
 <option value="department">By department</option>
 </select>
 </div>
 {scope === 'department' && (
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Department</label>
 <select
 value={departmentId}
 onChange={(e) => setDepartmentId(e.target.value)}
 className="px-4 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 min-w-[180px]"
 >
 <option value="">Select department</option>
 {departments.map((d) => (
 <option key={d.id} value={d.id}>{d.name}</option>
 ))}
 </select>
 </div>
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
 window.open(
 `/api/outsourcing/employees/template?mode=payroll-input`,
 '_blank',
 );
 }}
 className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
 >
 <Download className="w-4 h-4" />
 Download payroll template
 </button>
 <input
 id="payroll-input-import-file"
 type="file"
 accept=".xlsx,.xls"
 className="hidden"
 onChange={handlePayrollInputFileSelected}
 />
 <button
 type="button"
 disabled={importingPayrollInput}
 onClick={() => {
 const el = document.getElementById('payroll-input-import-file') as HTMLInputElement | null;
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
 importPreview.totals.invalid > 0 ||
 importPreview.totals.unmatched > 0 ||
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
 {importPreview && (
 <div className="mt-3 p-3 rounded-lg border border-primary-200 bg-primary-50 text-sm text-primary-900">
 Parsed: {importPreview.totals.parsedRows} · Matched: {importPreview.totals.matched} · Unmatched: {importPreview.totals.unmatched} · Invalid: {importPreview.totals.invalid}
 {importPreview.duplicateNationalIds.length > 0 && (
 <div className="mt-2 text-amber-800">
 Duplicate National IDs in sheet: {importPreview.duplicateNationalIds.join(', ')}
 </div>
 )}
 {importPreview.invalidRows.length > 0 && (
 <ul className="mt-2 text-red-800 text-xs list-disc list-inside space-y-0.5 max-h-24 overflow-auto">
 {importPreview.invalidRows.slice(0, 8).map((r, idx) => (
 <li key={`${r.row}-${idx}`}>Row {r.row}: {r.reason}</li>
 ))}
 </ul>
 )}
 </div>
 )}
 </div>
 </div>

 <div className="data-table-wrap">
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
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table min-w-[760px]">
 <thead>
 <tr>
 <th className="text-left">Employee</th>
 <th className="text-left">Facility</th>
 <th className="text-left">Dept</th>
 <th className="text-right">Basic</th>
 <th className="text-right">Gross</th>
 <th className="text-right">{entityConfig.payroll.deductionColumnHeaders.paye}</th>
 <th className="text-right">{entityConfig.payroll.deductionColumnHeaders.nssf}</th>
 <th className="text-right">{entityConfig.payroll.deductionColumnHeaders.nhif}</th>
 <th className="text-right">{entityConfig.payroll.deductionColumnHeaders.ahl}</th>
 <th className="text-right" title="Employer levy (not from net pay)">
 {entityConfig.payroll.deductionColumnHeaders.nita}
 </th>
 <th className="text-right">Net pay</th>
 <th className="text-left">Status</th>
 <th className="w-10 text-center">Edit</th>
 <th className="w-10 text-right">Send</th>
 </tr>
 </thead>
 <tbody>
 {payrolls.map((p) => (
 <tr key={p.id}>
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
 <td className="px-4 py-3 text-neutral-600">{p.departmentName ?? '—'}</td>
 <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(p.basicPay))}</td>
 <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(p.grossPay))}</td>
 <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(p.paye))}</td>
 <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(p.nssf))}</td>
 <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(p.nhif))}</td>
 <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(p.ahl ?? 0))}</td>
 <td className="px-4 py-3 text-right tabular-nums text-neutral-600">{formatCurrency(Number(p.nita ?? 0))}</td>
 <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(Number(p.netPay))}</td>
 <td className="px-4 py-3">
 <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
 p.status === 'paid' ? 'bg-emerald-50 text-emerald-700' :
 p.status === 'approved' ? 'bg-blue-50 text-blue-700' :
 'bg-amber-50 text-amber-700'
 }`}>
 {p.status}
 </span>
 </td>
 <td className="px-4 py-3 text-center">
 <button
 type="button"
 onClick={() => { setEditPayrollId(p.id); setEditEmployeeName(p.employeeName); }}
 title={`Edit pay for ${p.employeeName}`}
 className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-neutral-600 hover:bg-primary-50 hover:text-primary-700 transition-colors"
 >
 <Pencil className="w-4 h-4" />
 </button>
 </td>
 <td className="px-4 py-3 text-right">
 <Link
 href={`/dashboard/payroll/payslips?month=${month}&year=${year}&employeeIds=${encodeURIComponent(p.employeeId)}`}
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
 </div>
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
 {importPreview.totals.unmatched} row(s) have National IDs not found in this workspace. Create these employees now, then continue payroll import?
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
 {pendingSendPayslip && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
 <div className="w-full max-w-lg bg-white rounded-xl shadow-lg border border-neutral-200 p-5 sm:p-6">
 <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
 <AlertTriangle className="w-5 h-5 text-amber-600" />
 Confirm sending payslip
 </h3>
 <p className="text-sm text-neutral-600 mt-1">
 Send payslip for {pendingSendPayslip.employeeName} ({MONTHS[month - 1]} {year}) now?
 </p>
 <div className="mt-5 flex items-center justify-end gap-2">
 <button
 type="button"
 className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-800 hover:bg-neutral-50"
 onClick={() => setPendingSendPayslip(null)}
 >
 Cancel
 </button>
 <button
 type="button"
 className="px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800"
 onClick={async () => {
 const action = pendingSendPayslip;
 setPendingSendPayslip(null);
 await executeSendPayslip(action.employeeId, action.employeeName);
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
