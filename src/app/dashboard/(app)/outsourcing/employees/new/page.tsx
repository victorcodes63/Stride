'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
 Banknote,
 ChevronLeft,
 Download,
 FileSpreadsheet,
 IdCard,
 Loader2,
 Upload,
 UserPlus,
 UserRound,
} from 'lucide-react';
import { OutsourcingClientSwitcher } from '@/components/outsourcing/OutsourcingClientSwitcher';
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { StrideSelect } from '@/components/ui/stride-select';

const inputClass = 'dash-setup-input';

function SectionCard({
 title,
 description,
 icon: Icon,
 children,
}: {
 title: string;
 description?: string;
 icon?: React.ComponentType<{ className?: string }>;
 children: ReactNode;
}) {
 return (
 <section className="dashboard-surface space-y-5 p-5 shadow-sm sm:p-6">
 <div>
 <h2 className="flex items-center gap-2 text-lg font-semibold dash-setup-heading">
 {Icon ? <Icon className="h-5 w-5 dash-setup-heading-icon" /> : null}
 {title}
 </h2>
 {description ? <p className="mt-1 text-sm dash-setup-muted">{description}</p> : null}
 </div>
 {children}
 </section>
 );
}

function Field({
 label,
 hint,
 optional,
 required,
 htmlFor,
 children,
}: {
 label: string;
 hint?: string;
 optional?: boolean;
 required?: boolean;
 htmlFor?: string;
 children: ReactNode;
}) {
 return (
 <div>
 <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium dash-setup-label">
 {label}
 {required ? <span className="ml-0.5 text-[var(--brand-primary)]">*</span> : null}
 {optional ? <span className="ml-1 font-normal dash-setup-muted">(optional)</span> : null}
 </label>
 {children}
 {hint ? <p className="mt-1 text-xs dash-setup-muted">{hint}</p> : null}
 </div>
 );
}

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
 const { clients, clientId, setClientId, showSwitcher } = useOutsourcingClient();

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

 if (!clientId) {
 setError('Select an end-client before adding an employee.');
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
 router.push('/dashboard/outsourcing/employees');
 router.refresh();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Something went wrong.');
 } finally {
 setSubmitting(false);
 }
 };

 return (
 <DashboardPage>
 <div className="flex flex-col gap-3">
 <nav aria-label="Breadcrumb">
 <ol className="flex items-center gap-1.5 text-sm dash-setup-muted">
 <li>
 <Link
 href="/dashboard/outsourcing/employees"
 className="inline-flex items-center gap-1 dash-setup-link"
 >
 <ChevronLeft className="h-4 w-4" />
 Employees
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li className="font-medium dash-setup-heading">Add employee</li>
 </ol>
 </nav>

 <DashboardPageHeader
 title="Add employee"
 description="Add one person below, or import many at once with Excel."
 />
 </div>

 {showSwitcher ? (
 <div className="mb-6 max-w-md">
 <OutsourcingClientSwitcher clients={clients} value={clientId} onChange={setClientId} />
 </div>
 ) : null}

 <div className="space-y-6">
 <SectionCard
 title="Import multiple (Excel)"
 description="Download the template, fill in the rows, and import."
 icon={FileSpreadsheet}
 >
 <div className="flex flex-wrap gap-2">
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
 className="btn-secondary inline-flex items-center gap-2"
 >
 <Download className="h-4 w-4" />
 Download template
 </button>
 <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
 <button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 disabled={importing}
 className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
 >
 {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
 {importing ? 'Importing…' : 'Import Excel'}
 </button>
 </div>

 {importError ? (
 <div className="rounded-lg border border-[var(--dash-danger-border)] bg-[var(--dash-danger-bg)] p-3 text-sm text-[var(--dash-danger-fg)]">
 {importError}
 </div>
 ) : null}

 {importResult ? (
 <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-4 text-sm dash-setup-label">
 Created: <strong>{importResult.created ?? 0}</strong>
 {importResult.skipped ? <> · Skipped: <strong>{importResult.skipped}</strong></> : null}
 {importResult.errors ? <> · Errors: <strong>{importResult.errors}</strong></> : null}
 {importResult.errorDetails?.length ? (
 <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-[var(--dash-danger-fg)]">
 {importResult.errorDetails.map((rowErr, i) => (
 <li key={i}>
 Row {rowErr.row}: {rowErr.reason}
 </li>
 ))}
 </ul>
 ) : null}
 <div className="mt-3">
 <Link href="/dashboard/outsourcing/employees" className="dash-setup-link text-sm font-medium">
 View employees
 </Link>
 </div>
 </div>
 ) : null}

 {departmentPrompt ? (
 <div className="rounded-lg border border-[var(--dash-warning-border)] bg-[var(--dash-warning-bg)] p-4 text-sm">
 <p className="font-medium text-[var(--dash-warning-fg)]">Missing departments found in file</p>
 <ul className="mt-2 list-inside list-disc text-[var(--dash-warning-fg)]">
 {departmentPrompt.map((d, i) => (
 <li key={`${d}-${i}`}>{d}</li>
 ))}
 </ul>
 <div className="mt-3 flex flex-wrap gap-2">
 <button
 type="button"
 onClick={handleCreateMissingDepartmentsAndImport}
 disabled={importing}
 className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
 >
 {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
 Create departments and continue
 </button>
 <button type="button" onClick={() => setDepartmentPrompt(null)} className="btn-secondary">
 Cancel
 </button>
 </div>
 </div>
 ) : null}
 </SectionCard>

 <form onSubmit={handleSubmit} className="space-y-6">
 {error ? (
 <div className="rounded-xl border border-[var(--dash-danger-border)] bg-[var(--dash-danger-bg)] p-4 text-sm text-[var(--dash-danger-fg)]">
 {error}
 </div>
 ) : null}

 <SectionCard title="Personal details" icon={UserRound}>
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <Field label="First name" required htmlFor="firstName">
 <input id="firstName" value={form.firstName} onChange={update('firstName')} className={inputClass} required />
 </Field>
 <Field label="Last name" required htmlFor="lastName">
 <input id="lastName" value={form.lastName} onChange={update('lastName')} className={inputClass} required />
 </Field>
 <Field label="Email" optional htmlFor="email">
 <input id="email" type="email" value={form.email} onChange={update('email')} className={inputClass} />
 </Field>
 <Field label="Phone" htmlFor="phone">
 <input id="phone" type="tel" value={form.phone} onChange={update('phone')} className={inputClass} />
 </Field>
 </div>
 </SectionCard>

 <SectionCard title="Role & assignment" icon={UserPlus}>
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <Field label="Job title" htmlFor="jobTitle">
 <input id="jobTitle" value={form.jobTitle} onChange={update('jobTitle')} className={inputClass} />
 </Field>
 <Field label="Department" htmlFor="departmentId">
 <StrideSelect
 id="departmentId"
 ariaLabel="Department"
 value={form.departmentId}
 onChange={(value) => setForm((f) => ({ ...f, departmentId: value }))}
 options={[
 { value: '', label: '— None (assign later) —' },
 ...departments.map((d) => ({ value: d.id, label: d.name })),
 ]}
 />
 </Field>
 <Field label="Employee number" optional htmlFor="employeeNumber">
 <input id="employeeNumber" value={form.employeeNumber} onChange={update('employeeNumber')} className={inputClass} />
 </Field>
 <Field label="Date of joining" htmlFor="dateOfJoining">
 <input id="dateOfJoining" type="date" value={form.dateOfJoining} onChange={update('dateOfJoining')} className={inputClass} />
 </Field>
 <Field label="Monthly basic salary (KES)" htmlFor="baseSalary">
 <input id="baseSalary" type="number" min={0} step={1} value={form.baseSalary} onChange={update('baseSalary')} className={inputClass} />
 </Field>
 <div className="hidden sm:block" aria-hidden />
 <Field label="Cost centre code" htmlFor="costCenterCode">
 <input id="costCenterCode" value={form.costCenterCode} onChange={update('costCenterCode')} className={inputClass} />
 </Field>
 <Field label="Cost centre name" htmlFor="costCenterName">
 <input id="costCenterName" value={form.costCenterName} onChange={update('costCenterName')} className={inputClass} />
 </Field>
 </div>
 </SectionCard>

 <SectionCard
 title="Statutory details"
 description="Optional now — you can complete these later before running payroll."
 icon={IdCard}
 >
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <Field label="National ID number" optional htmlFor="idNumber">
 <input id="idNumber" value={form.idNumber} onChange={update('idNumber')} className={inputClass} />
 </Field>
 <Field label="KRA PIN" optional htmlFor="kraPin">
 <input id="kraPin" value={form.kraPin} onChange={update('kraPin')} className={`${inputClass} uppercase`} />
 </Field>
 <Field label="NSSF number" optional htmlFor="nssfNumber">
 <input id="nssfNumber" value={form.nssfNumber} onChange={update('nssfNumber')} className={inputClass} />
 </Field>
 <Field label="NHIF / SHIF number" optional htmlFor="nhifNumber">
 <input id="nhifNumber" value={form.nhifNumber} onChange={update('nhifNumber')} className={inputClass} />
 </Field>
 </div>
 </SectionCard>

 <SectionCard
 title="Bank details"
 description="Optional — used for salary disbursement."
 icon={Banknote}
 >
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <Field label="Bank name" optional htmlFor="bankName">
 <input id="bankName" value={form.bankName} onChange={update('bankName')} className={inputClass} />
 </Field>
 <Field label="Branch" optional htmlFor="bankBranch">
 <input id="bankBranch" value={form.bankBranch} onChange={update('bankBranch')} className={inputClass} />
 </Field>
 <Field label="Account number" optional htmlFor="bankAccountNumber">
 <input id="bankAccountNumber" value={form.bankAccountNumber} onChange={update('bankAccountNumber')} className={inputClass} />
 </Field>
 </div>
 </SectionCard>

 <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
 <Link href="/dashboard/outsourcing/employees" className="btn-secondary inline-flex items-center justify-center">
 Cancel
 </Link>
 <button
 type="submit"
 disabled={submitting}
 className="btn-primary dash-panel-cta inline-flex items-center justify-center gap-2 disabled:opacity-60"
 >
 {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
 {submitting ? 'Saving…' : 'Add employee'}
 </button>
 </div>
 </form>
 </div>
 </DashboardPage>
 );
}

export default function NewEmployeePage() {
 return (
 <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-2xl bg-[var(--dash-surface-muted)]" />}>
 <NewEmployeeForm />
 </Suspense>
 );
}

