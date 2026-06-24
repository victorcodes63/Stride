'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Download, Upload } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

const inputClass =
 'w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base bg-white';

type ImportResponse = {
 needsDepartmentCreation?: boolean;
 missingDepartments?: string[];
 created?: number;
 skipped?: number;
 errors?: number;
 errorDetails?: { row: number; reason: string }[];
};

function NewEmployeeForm() {
 const router = useRouter();
 const fileInputRef = useRef<HTMLInputElement>(null);

 const [clientId, setClientId] = useState('');
 const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
 const [form, setForm] = useState({
 firstName: '',
 lastName: '',
 email: '',
 phone: '',
 employeeNumber: '',
 jobTitle: '',
 departmentId: '',
 costCenterCode: '',
 costCenterName: '',
 idNumber: '',
 kraPin: '',
 nssfNumber: '',
 nhifNumber: '',
 dateOfJoining: '',
 bankName: '',
 bankBranch: '',
 bankAccountNumber: '',
 baseSalary: '',
 });
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [importing, setImporting] = useState(false);
 const [importError, setImportError] = useState<string | null>(null);
 const [importResult, setImportResult] = useState<ImportResponse | null>(null);
 const [pendingFile, setPendingFile] = useState<File | null>(null);
 const [departmentPrompt, setDepartmentPrompt] = useState<string[] | null>(null);

 useEffect(() => {
 fetch('/api/outsourcing/clients')
 .then((r) => r.json())
 .then((data) => {
 if (Array.isArray(data) && data[0]?.id) {
 setClientId(String(data[0].id));
 }
 })
 .catch(() => {});
 }, []);

 useEffect(() => {
 if (!clientId) {
 setDepartments([]);
 return;
 }
 fetch(`/api/outsourcing/clients/${clientId}/departments`)
 .then((r) => r.json())
 .then((data) => setDepartments(Array.isArray(data) ? data : []))
 .catch(() => setDepartments([]));
 }, [clientId]);

 const update =
 (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
 setForm((f) => ({ ...f, [key]: e.target.value }));

 const submitImport = async (file: File, autoCreateDepartments: boolean) => {
 const formData = new FormData();
 formData.append('file', file);
 if (clientId) formData.append('clientId', clientId);
 if (autoCreateDepartments) formData.append('autoCreateDepartments', 'true');

 const res = await fetch('/api/outsourcing/employees/import', { method: 'POST', body: formData });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Import failed');
 return data as ImportResponse;
 };

 const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 e.target.value = '';
 if (!file) return;

 setPendingFile(file);
 setDepartmentPrompt(null);
 setImporting(true);
 setImportError(null);
 setImportResult(null);
 try {
 const data = await submitImport(file, false);
 if (data.needsDepartmentCreation) {
 setDepartmentPrompt(Array.isArray(data.missingDepartments) ? data.missingDepartments : []);
 } else {
 setImportResult(data);
 }
 } catch (err) {
 setImportError(err instanceof Error ? err.message : 'Import failed');
 } finally {
 setImporting(false);
 }
 };

 const handleCreateMissingDepartmentsAndImport = async () => {
 if (!pendingFile) return;
 setImporting(true);
 setImportError(null);
 try {
 const data = await submitImport(pendingFile, true);
 setImportResult(data);
 setDepartmentPrompt(null);
 if (clientId) {
 const deptRes = await fetch(`/api/outsourcing/clients/${clientId}/departments`);
 const deptData = await deptRes.json().catch(() => []);
 if (Array.isArray(deptData)) setDepartments(deptData);
 }
 } catch (err) {
 setImportError(err instanceof Error ? err.message : 'Import failed');
 } finally {
 setImporting(false);
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError(null);
 if (!form.firstName.trim() || !form.lastName.trim()) {
 setError('First name and last name are required.');
 return;
 }
 const emailTrim = form.email.trim();
 if (emailTrim && !/\S+@\S+\.\S+/.test(emailTrim)) {
 setError('Please enter a valid email address, or leave email blank.');
 return;
 }

 setSubmitting(true);
 try {
 const res = await fetch('/api/outsourcing/employees', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 ...(clientId ? { clientId } : {}),
 firstName: form.firstName.trim(),
 lastName: form.lastName.trim(),
 email: form.email.trim() || null,
 phone: form.phone.trim() || null,
 ...(form.employeeNumber.trim() ? { employeeNumber: form.employeeNumber.trim() } : {}),
 jobTitle: form.jobTitle.trim() || null,
 departmentId: form.departmentId.trim() || null,
 idNumber: form.idNumber.trim() || null,
 kraPin: form.kraPin.trim() || null,
 nssfNumber: form.nssfNumber.trim() || null,
 nhifNumber: form.nhifNumber.trim() || null,
 dateOfJoining: form.dateOfJoining.trim() || null,
 bankName: form.bankName.trim() || null,
 bankBranch: form.bankBranch.trim() || null,
 bankAccountNumber: form.bankAccountNumber.trim() || null,
 ...(form.baseSalary.trim() ? { baseSalary: parseFloat(form.baseSalary.replace(/,/g, '')) || 0 } : {}),
 costCenterCode: form.costCenterCode.trim() || null,
 costCenterName: form.costCenterName.trim() || null,
 }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to add employee.');
 router.push('/dashboard/employees');
 router.refresh();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Something went wrong.');
 } finally {
 setSubmitting(false);
 }
 };

 return (
 <DashboardPage>
 <nav className="mb-4" aria-label="Breadcrumb">
 <ol className="flex items-center gap-1.5 text-sm text-neutral-500">
 <li>
 <Link href="/dashboard/employees" className="hover:text-primary-700">
 Employees
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li className="text-neutral-900 font-medium">Add employee</li>
 </ol>
 </nav>

 <div className="mb-6 flex items-start gap-3">
 <Link href="/dashboard/employees" className="mt-1 shrink-0 text-neutral-500 hover:text-primary-700" aria-label="Back">
 <ChevronLeft className="h-5 w-5" />
 </Link>
 <DashboardPageHeader
 title="Add employee"
 description="Add one person below, or import many at once with Excel."
 className="min-w-0 flex-1 !mb-0"
 />
 </div>

 <form onSubmit={handleSubmit} className="space-y-6">
 {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

 <div className="space-y-6 dashboard-surface p-5 shadow-sm sm:p-6 lg:p-8">
 <div className="rounded-xl border border-dashed border-primary-200 bg-primary-50/40 p-4 sm:p-5">
 <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
 <div>
 <h2 className="text-sm font-bold uppercase tracking-wide text-primary-900">Import multiple (Excel)</h2>
 <p className="mt-1 max-w-2xl text-sm text-neutral-600">
 Download the template, fill rows, and import. Department names must match existing departments or be left blank.
 </p>
 </div>
 <div className="flex shrink-0 flex-wrap gap-2">
 <button
 type="button"
 onClick={() =>
 window.open(
 clientId
 ? `/api/outsourcing/employees/template?clientId=${encodeURIComponent(clientId)}`
 : '/api/outsourcing/employees/template',
 '_blank',
 )
 }
 className="inline-flex items-center gap-2 rounded-lg border border-primary-300 bg-white px-4 py-2.5 text-sm font-medium text-primary-900 hover:bg-primary-50"
 >
 <Download className="h-4 w-4" />
 Download template
 </button>
 <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
 <button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 disabled={importing}
 className="inline-flex items-center gap-2 rounded-lg bg-primary-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50"
 >
 <Upload className="h-4 w-4" />
 {importing ? 'Importing...' : 'Import Excel'}
 </button>
 </div>
 </div>
 {importError ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{importError}</div> : null}
 {importResult ? (
 <div className="rounded-lg border border-primary-100 bg-white p-4 text-sm">
 Created: <strong>{importResult.created ?? 0}</strong>
 {importResult.skipped ? <> · Skipped: <strong>{importResult.skipped}</strong></> : null}
 {importResult.errors ? <> · Errors: <strong>{importResult.errors}</strong></> : null}
 {importResult.errorDetails?.length ? (
 <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-red-800">
 {importResult.errorDetails.map((rowErr, i) => (
 <li key={i}>
 Row {rowErr.row}: {rowErr.reason}
 </li>
 ))}
 </ul>
 ) : null}
 <div className="mt-3">
 <Link href="/dashboard/employees" className="text-sm font-medium text-primary-700 hover:underline">
 View employees
 </Link>
 </div>
 </div>
 ) : null}
 </div>

 {departmentPrompt ? (
 <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
 <p className="font-medium text-amber-900">Missing departments found in file</p>
 <ul className="mt-2 list-inside list-disc text-amber-800">
 {departmentPrompt.map((d, i) => (
 <li key={`${d}-${i}`}>{d}</li>
 ))}
 </ul>
 <div className="mt-3 flex gap-2">
 <button
 type="button"
 onClick={handleCreateMissingDepartmentsAndImport}
 disabled={importing}
 className="rounded-lg bg-primary-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
 >
 Create departments and continue
 </button>
 <button
 type="button"
 onClick={() => setDepartmentPrompt(null)}
 className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm"
 >
 Cancel
 </button>
 </div>
 </div>
 ) : null}

 <div className="grid grid-cols-1 gap-8 border-t border-neutral-100 pt-8 lg:grid-cols-2 lg:gap-12">
 <div className="space-y-4">
 <h2 className="border-b border-neutral-100 pb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">Person</h2>
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div>
 <label htmlFor="firstName" className="mb-1.5 block text-sm font-medium text-neutral-800">First name <span className="text-red-600">*</span></label>
 <input id="firstName" value={form.firstName} onChange={update('firstName')} className={inputClass} required />
 </div>
 <div>
 <label htmlFor="lastName" className="mb-1.5 block text-sm font-medium text-neutral-800">Last name <span className="text-red-600">*</span></label>
 <input id="lastName" value={form.lastName} onChange={update('lastName')} className={inputClass} required />
 </div>
 </div>
 <div>
 <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-800">Email <span className="font-normal text-neutral-400">(optional)</span></label>
 <input id="email" type="email" value={form.email} onChange={update('email')} className={inputClass} />
 </div>
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div>
 <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-neutral-800">Phone</label>
 <input id="phone" type="tel" value={form.phone} onChange={update('phone')} className={inputClass} />
 </div>
 <div>
 <label htmlFor="jobTitle" className="mb-1.5 block text-sm font-medium text-neutral-800">Job title</label>
 <input id="jobTitle" value={form.jobTitle} onChange={update('jobTitle')} className={inputClass} />
 </div>
 </div>
 </div>

 <div className="space-y-4 lg:border-l lg:border-neutral-100 lg:pl-10">
 <h2 className="border-b border-neutral-100 pb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">Assignment</h2>
 <div>
 <label htmlFor="departmentId" className="mb-1.5 block text-sm font-medium text-neutral-800">Department</label>
 <select id="departmentId" value={form.departmentId} onChange={update('departmentId')} className={inputClass}>
 <option value="">— None (assign later) —</option>
 {departments.map((d) => (
 <option key={d.id} value={d.id}>{d.name}</option>
 ))}
 </select>
 </div>
 <div>
 <label htmlFor="employeeNumber" className="mb-1.5 block text-sm font-medium text-neutral-800">EMP No. <span className="font-normal text-neutral-400">(optional)</span></label>
 <input id="employeeNumber" value={form.employeeNumber} onChange={update('employeeNumber')} className={inputClass} />
 </div>
 <div>
 <label htmlFor="dateOfJoining" className="mb-1.5 block text-sm font-medium text-neutral-800">Date of joining</label>
 <input id="dateOfJoining" type="date" value={form.dateOfJoining} onChange={update('dateOfJoining')} className={inputClass} />
 </div>
 <div>
 <label htmlFor="baseSalary" className="mb-1.5 block text-sm font-medium text-neutral-800">Monthly basic salary (KES)</label>
 <input id="baseSalary" type="number" min={0} step={1} value={form.baseSalary} onChange={update('baseSalary')} className={inputClass} />
 </div>
 <div>
 <label htmlFor="costCenterCode" className="mb-1.5 block text-sm font-medium text-neutral-800">Cost centre code</label>
 <input id="costCenterCode" value={form.costCenterCode} onChange={update('costCenterCode')} className={inputClass} />
 </div>
 <div>
 <label htmlFor="costCenterName" className="mb-1.5 block text-sm font-medium text-neutral-800">Cost centre name</label>
 <input id="costCenterName" value={form.costCenterName} onChange={update('costCenterName')} className={inputClass} />
 </div>
 </div>
 </div>
 </div>

 <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
 <Link href="/dashboard/employees" className="inline-flex justify-center rounded-xl border border-neutral-300 px-6 py-3 font-medium text-neutral-700 hover:bg-neutral-50">
 Cancel
 </Link>
 <button
 type="submit"
 disabled={submitting}
 className="inline-flex justify-center rounded-xl bg-primary-900 px-6 py-3 font-semibold text-white hover:bg-primary-800 disabled:opacity-50"
 >
 {submitting ? 'Saving...' : 'Add employee'}
 </button>
 </div>
 </form>
 </DashboardPage>
 );
}

export default function NewEmployeePage() {
 return (
 <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-2xl bg-neutral-100" />}>
 <NewEmployeeForm />
 </Suspense>
 );
}

