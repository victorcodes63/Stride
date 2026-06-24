'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Download, FileText, Pencil, Plus, Shield, Trash2, X } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

const inputClass =
 'w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base';

interface DepartmentOption {
 id: string;
 name: string;
}

type DocumentCategory =
 | 'CONTRACT'
 | 'IDENTIFICATION'
 | 'QUALIFICATION'
 | 'PERFORMANCE'
 | 'DISCIPLINARY'
 | 'POLICY_ACKNOWLEDGMENT'
 | 'MEDICAL'
 | 'OTHER';

interface EmployeeDocumentItem {
 id: string;
 title: string;
 category: DocumentCategory;
 fileName: string;
 fileSize: number | null;
 mimeType: string | null;
 uploadedBy: { name: string; email: string };
 uploadedAt: string;
 notes: string | null;
 downloadUrl: string;
}

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
 { value: 'CONTRACT', label: 'Contract' },
 { value: 'IDENTIFICATION', label: 'Identification' },
 { value: 'QUALIFICATION', label: 'Qualification' },
 { value: 'PERFORMANCE', label: 'Performance' },
 { value: 'DISCIPLINARY', label: 'Disciplinary' },
 { value: 'POLICY_ACKNOWLEDGMENT', label: 'Policy acknowledgment' },
 { value: 'MEDICAL', label: 'Medical' },
 { value: 'OTHER', label: 'Other' },
];

export default function EditEmployeePage() {
 const router = useRouter();
 const params = useParams();
 const id = params?.id as string | undefined;
 const [form, setForm] = useState({
 employeeNumber: '',
 firstName: '',
 lastName: '',
 email: '',
 phone: '',
 jobTitle: '',
 idNumber: '',
 kraPin: '',
 nssfNumber: '',
 nhifNumber: '',
 dateOfJoining: '',
 bankName: '',
 bankBranch: '',
 bankAccountNumber: '',
 baseSalary: '',
 departmentId: '',
 costCenterCode: '',
 costCenterName: '',
 });
 const [clientName, setClientName] = useState('');
 const [departments, setDepartments] = useState<DepartmentOption[]>([]);
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [documents, setDocuments] = useState<EmployeeDocumentItem[]>([]);
 const [workflows, setWorkflows] = useState<Array<{ id: string; type: string; status: string; tasks: Array<{ status: string }> }>>([]);
 const [documentsLoading, setDocumentsLoading] = useState(false);
 const [documentsError, setDocumentsError] = useState<string | null>(null);
 const [showUploadModal, setShowUploadModal] = useState(false);
 const [uploadingDocument, setUploadingDocument] = useState(false);
 const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
 const [viewerRole, setViewerRole] = useState<'admin' | 'staff' | 'viewer' | null>(null);
 const [viewerStaffType, setViewerStaffType] = useState<string | null>(null);
 const [lifecycleLoading, setLifecycleLoading] = useState<string | null>(null);
 const [disciplinaryCases, setDisciplinaryCases] = useState<Array<{ id: string; caseNumber: string; status: string; subject: string; resolvedAt: string | null }>>([]);
 const [docForm, setDocForm] = useState<{
 title: string;
 category: DocumentCategory;
 notes: string;
 file: File | null;
 }>({
 title: '',
 category: 'CONTRACT',
 notes: '',
 file: null,
 });

 const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
 setForm((f) => ({ ...f, [key]: e.target.value }));

 const canUploadDocuments = viewerRole === 'admin' || viewerStaffType === 'business_manager';
 const canDeleteDocuments = viewerRole === 'admin';
 const canViewDisciplinary = viewerRole === 'admin' || viewerStaffType === 'operations' || viewerStaffType === 'business_manager';
 const canManageLifecycle = viewerRole === 'admin' || viewerStaffType === 'business_manager';

 const runLifecycleAction = async (eventType: string) => {
 if (!id || !canManageLifecycle) return;
 setLifecycleLoading(eventType);
 try {
 const res = await fetch(`/api/outsourcing/employees/${id}/lifecycle`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ eventType, effectiveDate: new Date().toISOString().slice(0, 10) }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to run lifecycle action');
 router.refresh();
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to run lifecycle action');
 } finally {
 setLifecycleLoading(null);
 }
 };

 const fetchDocuments = async (employeeId: string) => {
 setDocumentsLoading(true);
 setDocumentsError(null);
 try {
 const res = await fetch(`/api/outsourcing/employees/${employeeId}/documents`);
 const data = await res.json().catch(() => []);
 if (!res.ok) throw new Error(data.error || 'Failed to load documents');
 setDocuments(Array.isArray(data) ? data : []);
 } catch (e) {
 setDocuments([]);
 setDocumentsError(e instanceof Error ? e.message : 'Failed to load documents');
 } finally {
 setDocumentsLoading(false);
 }
 };

 useEffect(() => {
 let cancelled = false;
 async function fetchViewer() {
 try {
 const res = await fetch('/api/auth/me');
 const data = await res.json().catch(() => null);
 if (!res.ok || !data || cancelled) return;
 setViewerRole(data.role ?? null);
 setViewerStaffType(data.staffUserType ?? null);
 } catch {
 // no-op
 }
 }
 void fetchViewer();
 return () => {
 cancelled = true;
 };
 }, []);

 useEffect(() => {
 if (!id) return;
 let cancelled = false;
 async function fetchData() {
 setLoading(true);
 setError(null);
 try {
 const res = await fetch(`/api/outsourcing/employees/${id}`);
 if (!res.ok) throw new Error('Failed to load employee');
 const emp = await res.json();
 if (cancelled) return;
 setForm({
 employeeNumber: emp.employeeNumber ?? '',
 firstName: emp.firstName ?? '',
 lastName: emp.lastName ?? '',
 email: emp.email ?? '',
 phone: emp.phone ?? '',
 jobTitle: emp.jobTitle ?? '',
 idNumber: emp.idNumber ?? '',
 kraPin: emp.kraPin ?? '',
 nssfNumber: emp.nssfNumber ?? '',
 nhifNumber: emp.nhifNumber ?? '',
 dateOfJoining: emp.dateOfJoining ?? '',
 bankName: emp.bankName ?? '',
 bankBranch: emp.bankBranch ?? '',
 bankAccountNumber: emp.bankAccountNumber ?? '',
 baseSalary: emp.baseSalary != null ? String(emp.baseSalary) : '',
 departmentId: emp.departmentId ?? '',
 costCenterCode: emp.costCenterCode ?? '',
 costCenterName: emp.costCenterName ?? '',
 });
 setClientName(emp.clientName ?? '');
 if (emp.clientId) {
 const deptRes = await fetch(`/api/outsourcing/clients/${emp.clientId}/departments`);
 const deptData = await deptRes.json().catch(() => []);
 if (!cancelled && Array.isArray(deptData)) {
 setDepartments(deptData.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })));
 }
 }
 if (!cancelled) {
 const employeeId = id as string;
 await fetchDocuments(employeeId);
 const disciplinary = await fetch(`/api/disciplinary/cases?employeeId=${employeeId}`).then((r) => r.json().catch(() => []));
 setDisciplinaryCases(Array.isArray(disciplinary) ? disciplinary : []);
 const wf = await fetch(`/api/onboarding/workflows?employeeId=${employeeId}`).then((r) => r.json().catch(() => []));
 setWorkflows(Array.isArray(wf) ? wf : []);
 }
 } catch (e) {
 if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load employee');
 } finally {
 if (!cancelled) setLoading(false);
 }
 }
 fetchData();
 return () => { cancelled = true; };
 }, [id]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!id) return;
 setError(null);
 setSubmitting(true);
 const fn = form.firstName.trim();
 const ln = form.lastName.trim();
 const em = form.email.trim();
 if (!fn) {
 setError('First name is required.');
 setSubmitting(false);
 return;
 }
 if (!ln) {
 setError('Last name is required.');
 setSubmitting(false);
 return;
 }
 if (em && !/\S+@\S+\.\S+/.test(em)) {
 setError('Please enter a valid email address, or clear the field.');
 setSubmitting(false);
 return;
 }
 const payload = {
 employeeNumber: form.employeeNumber.trim() || null,
 firstName: fn,
 lastName: ln,
 email: em || null,
 phone: form.phone.trim() || null,
 jobTitle: form.jobTitle.trim() || null,
 idNumber: form.idNumber.trim() || null,
 kraPin: form.kraPin.trim() || null,
 nssfNumber: form.nssfNumber.trim() || null,
 nhifNumber: form.nhifNumber.trim() || null,
 dateOfJoining: form.dateOfJoining.trim() || null,
 bankName: form.bankName.trim() || null,
 bankBranch: form.bankBranch.trim() || null,
 bankAccountNumber: form.bankAccountNumber.trim() || null,
 departmentId: form.departmentId.trim() || null,
 costCenterCode: form.costCenterCode.trim() || null,
 costCenterName: form.costCenterName.trim() || null,
 baseSalary: form.baseSalary.trim() ? parseFloat(form.baseSalary.replace(/,/g, '')) : null,
 };
 try {
 const res = await fetch(`/api/outsourcing/employees/${id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 setError(data.error || 'Failed to update employee.');
 setSubmitting(false);
 return;
 }
 router.push('/dashboard/outsourcing/employees');
 router.refresh();
 } catch {
 setError('Something went wrong. Please try again.');
 setSubmitting(false);
 }
 };

 const groupedDocuments = CATEGORY_OPTIONS.map((category) => ({
 ...category,
 items: documents.filter((doc) => doc.category === category.value),
 })).filter((group) => group.items.length > 0);

 const handleUploadDocument = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!id || !canUploadDocuments) return;
 if (!docForm.file) {
 setDocumentsError('Please choose a document file.');
 return;
 }
 if (!docForm.title.trim()) {
 setDocumentsError('Document title is required.');
 return;
 }
 setUploadingDocument(true);
 setDocumentsError(null);
 try {
 const body = new FormData();
 body.append('file', docForm.file);
 body.append('title', docForm.title.trim());
 body.append('category', docForm.category);
 if (docForm.notes.trim()) body.append('notes', docForm.notes.trim());
 const res = await fetch(`/api/outsourcing/employees/${id}/documents`, { method: 'POST', body });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to upload document');
 setShowUploadModal(false);
 setDocForm({ title: '', category: 'CONTRACT', notes: '', file: null });
 await fetchDocuments(id);
 } catch (err) {
 setDocumentsError(err instanceof Error ? err.message : 'Failed to upload document');
 } finally {
 setUploadingDocument(false);
 }
 };

 const handleDeleteDocument = async (docId: string) => {
 if (!id || !canDeleteDocuments) return;
 if (!window.confirm('Delete this document? This cannot be undone.')) return;
 setDeletingDocumentId(docId);
 setDocumentsError(null);
 try {
 const res = await fetch(`/api/outsourcing/employees/${id}/documents/${docId}`, { method: 'DELETE' });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to delete document');
 await fetchDocuments(id);
 } catch (err) {
 setDocumentsError(err instanceof Error ? err.message : 'Failed to delete document');
 } finally {
 setDeletingDocumentId(null);
 }
 };

 if (!id) return null;
 if (loading) {
 return (
 <DashboardPage>
 <div className="animate-pulse space-y-4 w-full">
 <div className="h-6 bg-neutral-200 rounded w-1/3" />
 <div className="h-10 bg-neutral-100 rounded w-full" />
 <div className="h-10 bg-neutral-100 rounded w-full" />
 </div>
 </DashboardPage>
 );
 }

 return (
 <DashboardPage>
 <nav className="mb-4 sm:mb-5" aria-label="Breadcrumb">
 <ol className="flex items-center gap-1.5 text-sm text-neutral-500">
 <li>
 <Link href="/dashboard/outsourcing/employees" className="hover:text-primary-700 transition-colors">
 Employees
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li className="text-primary-900 font-medium" aria-current="page">
 Edit employee
 </li>
 </ol>
 </nav>
 <DashboardPageHeader
 title="Edit employee"
 description={`Update ${form.firstName} ${form.lastName}${clientName ? ` at ${clientName}` : ''}.`}
 className="mb-6 sm:mb-8"
 />

 <form onSubmit={handleSubmit} className="w-full space-y-6 sm:space-y-8">
 {error && (
 <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
 {error}
 </div>
 )}
 <div className="dashboard-surface shadow-sm p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
 <div>
 <label htmlFor="employeeNumber" className="block text-sm font-medium text-primary-900 mb-2">EMP No.</label>
 <input id="employeeNumber" type="text" value={form.employeeNumber} onChange={update('employeeNumber')} placeholder="e.g. 001" className={inputClass} />
 </div>
 <div>
 <label htmlFor="firstName" className="block text-sm font-medium text-primary-900 mb-2">First name <span className="text-red-600">*</span></label>
 <input id="firstName" type="text" value={form.firstName} onChange={update('firstName')} required className={inputClass} />
 </div>
 <div>
 <label htmlFor="lastName" className="block text-sm font-medium text-primary-900 mb-2">Last name <span className="text-red-600">*</span></label>
 <input id="lastName" type="text" value={form.lastName} onChange={update('lastName')} required className={inputClass} />
 </div>
 <div>
 <label htmlFor="email" className="block text-sm font-medium text-primary-900 mb-2">
 Email <span className="text-neutral-500 font-normal">(optional)</span>
 </label>
 <input
 id="email"
 type="email"
 value={form.email}
 onChange={update('email')}
 className={inputClass}
 placeholder="Add when payslips should be emailed"
 />
 </div>
 <div>
 <label htmlFor="phone" className="block text-sm font-medium text-primary-900 mb-2">Phone</label>
 <input id="phone" type="tel" value={form.phone} onChange={update('phone')} placeholder="+254 700 123 456" className={inputClass} />
 </div>
 <div>
 <label htmlFor="jobTitle" className="block text-sm font-medium text-primary-900 mb-2">Position / Job title</label>
 <input id="jobTitle" type="text" value={form.jobTitle} onChange={update('jobTitle')} placeholder="e.g. Accountant, Cleaner" className={inputClass} />
 </div>
 <div>
 <label htmlFor="departmentId" className="block text-sm font-medium text-primary-900 mb-2">Department</label>
 <select id="departmentId" value={form.departmentId} onChange={update('departmentId')} className={inputClass}>
 <option value="">— No department —</option>
 {departments.map((d) => (
 <option key={d.id} value={d.id}>{d.name}</option>
 ))}
 </select>
 </div>
 <div>
 <label htmlFor="dateOfJoining" className="block text-sm font-medium text-primary-900 mb-2">Date of joining</label>
 <input id="dateOfJoining" type="date" value={form.dateOfJoining} onChange={update('dateOfJoining')} className={inputClass} />
 </div>
 <div>
 <label htmlFor="costCenterCode" className="block text-sm font-medium text-primary-900 mb-2">Cost centre code</label>
 <input id="costCenterCode" type="text" value={form.costCenterCode} onChange={update('costCenterCode')} className={inputClass} />
 </div>
 <div>
 <label htmlFor="costCenterName" className="block text-sm font-medium text-primary-900 mb-2">Cost centre name</label>
 <input id="costCenterName" type="text" value={form.costCenterName} onChange={update('costCenterName')} className={inputClass} />
 </div>
 <div className="sm:col-span-2">
 <label htmlFor="baseSalary" className="block text-sm font-medium text-primary-900 mb-2">
 Monthly basic salary (KES)
 </label>
 <input
 id="baseSalary"
 type="number"
 min={0}
 step={1}
 value={form.baseSalary}
 onChange={update('baseSalary')}
 placeholder="Pre-fills payroll when you generate a month"
 className={inputClass}
 />
 <p className="text-xs text-neutral-500 mt-1">Leave blank if pay varies every month; use payroll screen only.</p>
 </div>
 </div>

 <div className="border-t border-neutral-100 pt-5 sm:pt-6">
 <h2 className="text-base sm:text-lg font-semibold text-primary-900 mb-3 sm:mb-4">Tax & ID (Kenya)</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
 <div>
 <label htmlFor="idNumber" className="block text-sm font-medium text-primary-900 mb-2">National ID</label>
 <input id="idNumber" type="text" value={form.idNumber} onChange={update('idNumber')} className={inputClass} />
 </div>
 <div>
 <label htmlFor="kraPin" className="block text-sm font-medium text-primary-900 mb-2">KRA PIN</label>
 <input id="kraPin" type="text" value={form.kraPin} onChange={update('kraPin')} placeholder="e.g. A001234567K" className={inputClass} />
 </div>
 <div>
 <label htmlFor="nssfNumber" className="block text-sm font-medium text-primary-900 mb-2">NSSF number</label>
 <input id="nssfNumber" type="text" value={form.nssfNumber} onChange={update('nssfNumber')} className={inputClass} />
 </div>
 <div>
 <label htmlFor="nhifNumber" className="block text-sm font-medium text-primary-900 mb-2">NHIF number</label>
 <input id="nhifNumber" type="text" value={form.nhifNumber} onChange={update('nhifNumber')} className={inputClass} />
 </div>
 </div>
 </div>

 <div className="border-t border-neutral-100 pt-5 sm:pt-6">
 <h2 className="text-base sm:text-lg font-semibold text-primary-900 mb-3 sm:mb-4">Bank details (salary disbursement)</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
 <div>
 <label htmlFor="bankName" className="block text-sm font-medium text-primary-900 mb-2">Bank name</label>
 <input id="bankName" type="text" value={form.bankName} onChange={update('bankName')} placeholder="e.g. Equity, KCB" className={inputClass} />
 </div>
 <div>
 <label htmlFor="bankBranch" className="block text-sm font-medium text-primary-900 mb-2">Branch</label>
 <input id="bankBranch" type="text" value={form.bankBranch} onChange={update('bankBranch')} placeholder="e.g. Westlands" className={inputClass} />
 </div>
 <div>
 <label htmlFor="bankAccountNumber" className="block text-sm font-medium text-primary-900 mb-2">Account number</label>
 <input id="bankAccountNumber" type="text" value={form.bankAccountNumber} onChange={update('bankAccountNumber')} className={inputClass} />
 </div>
 </div>
 </div>

 <div className="border-t border-neutral-100 pt-5 sm:pt-6">
 {canManageLifecycle ? (
 <div className="mb-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
 <h2 className="mb-2 text-base font-semibold text-primary-900">Lifecycle actions</h2>
 <div className="flex flex-wrap gap-2">
 {['hire', 'confirmation', 'promotion', 'transfer', 'suspension', 'separation'].map((eventType) => (
 <button
 key={eventType}
 type="button"
 onClick={() => runLifecycleAction(eventType)}
 disabled={lifecycleLoading !== null}
 className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
 >
 {lifecycleLoading === eventType ? 'Applying...' : eventType}
 </button>
 ))}
 </div>
 </div>
 ) : null}
 <h2 className="text-base sm:text-lg font-semibold text-primary-900 mb-3 sm:mb-4">Onboarding</h2>
 {(() => {
 const active = workflows.find((workflow) => workflow.status === 'IN_PROGRESS');
 const completed = workflows.filter((workflow) => workflow.status === 'COMPLETED').length;
 const totalTasks = active?.tasks.length ?? 0;
 const done = active?.tasks.filter((task) => task.status === 'COMPLETED').length ?? 0;
 const overdue = active?.tasks.filter((task) => task.status === 'OVERDUE').length ?? 0;
 return (
 <div className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
 <p>
 {active
 ? `${active.type} ${done}/${totalTasks} complete - ${Math.max(totalTasks - done, 0)} tasks remaining, ${overdue} overdue`
 : 'No active onboarding/offboarding workflow'}
 </p>
 <p className="mt-1">Completed workflows: {completed}</p>
 {active ? (
 <Link href={`/dashboard/onboarding/${active.id}`} className="mt-2 inline-flex text-primary-700 hover:underline">
 Open workflow details
 </Link>
 ) : null}
 </div>
 );
 })()}
 </div>

 <div className="border-t border-neutral-100 pt-5 sm:pt-6">
 {canViewDisciplinary ? (
 <div className="mb-6">
 <div className="mb-3 flex items-center justify-between">
 <h2 className="text-base sm:text-lg font-semibold text-primary-900">Disciplinary</h2>
 <button
 type="button"
 onClick={async () => {
 const payload = {
 employeeId: id,
 subject: `New disciplinary case for ${form.firstName} ${form.lastName}`,
 description: 'Document incident details here.',
 type: 'MISCONDUCT',
 severity: 'MINOR',
 incidentDate: new Date().toISOString(),
 };
 const res = await fetch('/api/disciplinary/cases', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });
 const body = await res.json().catch(() => null);
 if (res.ok && body?.id) router.push(`/dashboard/disciplinary/cases/${body.id}`);
 }}
 className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700"
 >
 New case
 </button>
 </div>
 {disciplinaryCases.length === 0 ? (
 <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-4 text-sm text-neutral-600">No disciplinary cases on file.</p>
 ) : (
 <div className="space-y-2">
 {disciplinaryCases.map((item) => (
 <Link key={item.id} href={`/dashboard/disciplinary/cases/${item.id}`} className="block rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-50">
 <p className="text-sm font-semibold text-primary-900">{item.caseNumber} - {item.subject}</p>
 <p className="text-xs text-neutral-600">Status: {item.status.replaceAll('_', ' ')}</p>
 </Link>
 ))}
 </div>
 )}
 </div>
 ) : null}
 <div className="mb-4 flex items-center justify-between gap-3">
 <div>
 <h2 className="text-base sm:text-lg font-semibold text-primary-900">Documents</h2>
 <p className="text-sm text-neutral-600">Upload and manage employee HR documents in one place.</p>
 </div>
 {canUploadDocuments ? (
 <button
 type="button"
 onClick={() => setShowUploadModal(true)}
 className="inline-flex items-center gap-2 rounded-lg bg-primary-900 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800"
 >
 <Plus className="h-4 w-4" />
 Upload
 </button>
 ) : null}
 </div>

 {documentsError ? (
 <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{documentsError}</div>
 ) : null}

 {documentsLoading ? (
 <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">Loading documents...</div>
 ) : groupedDocuments.length === 0 ? (
 <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/70 px-6 py-10 text-center">
 <FileText className="mx-auto mb-3 h-12 w-12 text-neutral-400" />
 <p className="text-base font-semibold text-neutral-900">No documents uploaded</p>
 <p className="mt-1 text-sm text-neutral-600">
 Upload contracts, identification, qualifications, and other HR documents.
 </p>
 {canUploadDocuments ? (
 <button
 type="button"
 onClick={() => setShowUploadModal(true)}
 className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-900 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800"
 >
 <Plus className="h-4 w-4" />
 Upload document
 </button>
 ) : null}
 </div>
 ) : (
 <div className="space-y-6">
 {groupedDocuments.map((group) => (
 <div key={group.value}>
 <p className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">{group.label}</p>
 <div className="space-y-2">
 {group.items.map((doc) => (
 <div key={doc.id} className="dashboard-surface rounded-lg px-4 py-3">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div className="min-w-0">
 <div className="flex flex-wrap items-center gap-2">
 <p className="text-sm font-semibold text-primary-900">{doc.title}</p>
 <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
 {group.label}
 </span>
 {doc.category === 'MEDICAL' ? (
 <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
 <Shield className="h-3 w-3" />
 Sensitive
 </span>
 ) : null}
 </div>
 <p className="mt-1 text-xs text-neutral-600">
 Uploaded by {doc.uploadedBy.name} on {new Date(doc.uploadedAt).toLocaleDateString()}
 </p>
 <p className="mt-1 text-xs text-neutral-500">{doc.fileName}</p>
 {doc.notes ? <p className="mt-1 text-xs text-neutral-600">{doc.notes}</p> : null}
 </div>
 <div className="flex items-center gap-2">
 <a
 href={doc.downloadUrl}
 className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
 >
 <Download className="h-3.5 w-3.5" />
 Download
 </a>
 {canDeleteDocuments ? (
 <button
 type="button"
 onClick={() => handleDeleteDocument(doc.id)}
 disabled={deletingDocumentId === doc.id}
 className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
 >
 <Trash2 className="h-3.5 w-3.5" />
 {deletingDocumentId === doc.id ? 'Deleting...' : 'Delete'}
 </button>
 ) : null}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 <div className="pt-6 sm:pt-8 mt-6 sm:mt-8 border-t border-neutral-200 flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-3 sm:gap-4">
 <Link
 href="/dashboard/outsourcing/employees"
 className="w-full sm:w-auto order-2 sm:order-1 px-6 py-3 min-h-[44px] sm:min-h-0 border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors inline-flex items-center justify-center"
 >
 Cancel
 </Link>
 <button
 type="submit"
 disabled={submitting}
 className="w-full sm:w-auto order-1 sm:order-2 px-6 py-3 min-h-[44px] sm:min-h-0 bg-primary-900 text-white rounded-lg font-semibold hover:bg-primary-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
 >
 <Pencil className="w-4 h-4" />
 {submitting ? 'Saving…' : 'Save changes'}
 </button>
 </div>
 </div>
 </form>
 {showUploadModal ? (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
 <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
 <div className="mb-4 flex items-center justify-between">
 <h3 className="text-lg font-semibold text-primary-900">Upload document</h3>
 <button
 type="button"
 onClick={() => setShowUploadModal(false)}
 className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
 >
 <X className="h-5 w-5" />
 </button>
 </div>
 <form onSubmit={handleUploadDocument} className="space-y-4">
 <div>
 <label className="mb-2 block text-sm font-medium text-primary-900">Document file (PDF)</label>
 <input
 type="file"
 accept="application/pdf"
 onChange={(e) => setDocForm((prev) => ({ ...prev, file: e.target.files?.[0] ?? null }))}
 className={inputClass}
 />
 </div>
 <div>
 <label className="mb-2 block text-sm font-medium text-primary-900">Title</label>
 <input
 type="text"
 value={docForm.title}
 onChange={(e) => setDocForm((prev) => ({ ...prev, title: e.target.value }))}
 className={inputClass}
 placeholder="Employment contract, National ID copy, etc."
 />
 </div>
 <div>
 <label className="mb-2 block text-sm font-medium text-primary-900">Category</label>
 <select
 value={docForm.category}
 onChange={(e) => setDocForm((prev) => ({ ...prev, category: e.target.value as DocumentCategory }))}
 className={inputClass}
 >
 {CATEGORY_OPTIONS.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="mb-2 block text-sm font-medium text-primary-900">Notes (optional)</label>
 <textarea
 value={docForm.notes}
 onChange={(e) => setDocForm((prev) => ({ ...prev, notes: e.target.value }))}
 className={`${inputClass} min-h-[88px]`}
 />
 </div>
 <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
 <button
 type="button"
 onClick={() => setShowUploadModal(false)}
 className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={uploadingDocument}
 className="rounded-lg bg-primary-900 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
 >
 {uploadingDocument ? 'Uploading...' : 'Upload document'}
 </button>
 </div>
 </form>
 </div>
 </div>
 ) : null}
 </DashboardPage>
 );
}
