'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type ContractDetail = {
 id: string;
 title: string | null;
 reference: string | null;
 contractType: 'employee' | 'consultant';
 startDate: string | null;
 endDate: string;
 remindersDisabled: boolean;
 managers: Array<{ id: string; name: string; email: string }>;
 updatedAt: string;
};

type StaffUser = { id: string; name: string; email: string };
type AttachmentItem = {
 name: string;
 originalName: string;
 size: number;
 uploadedAt: string;
 url: string;
};

function addMonths(isoDate: string, months: number) {
 const d = new Date(`${isoDate}T12:00:00`);
 const day = d.getDate();
 d.setMonth(d.getMonth() + months);
 if (d.getDate() < day) d.setDate(0);
 return d.toISOString().slice(0, 10);
}

function getStatus(endDate: string) {
 const now = new Date();
 const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
 const end = new Date(`${endDate}T00:00:00`);
 const diffDays = Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
 if (diffDays < 0) return { label: 'Expired', className: 'bg-red-50 text-red-700' };
 if (diffDays <= 30) return { label: 'Expiring', className: 'bg-amber-50 text-amber-700' };
 return { label: 'Active', className: 'bg-emerald-50 text-emerald-700' };
}

export default function PeopleContractDetailPage() {
 const params = useParams<{ id: string }>();
 const id = params?.id;
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [renewing, setRenewing] = useState(false);
 const [uploading, setUploading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [contract, setContract] = useState<ContractDetail | null>(null);
 const [allUsers, setAllUsers] = useState<StaffUser[]>([]);
 const [managerIds, setManagerIds] = useState<string[]>([]);
 const [remindersDisabled, setRemindersDisabled] = useState(false);
 const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
 const [renewEndDate, setRenewEndDate] = useState('');

 const loadContract = async (contractId: string) => {
 const data = await fetch(`/api/people/contracts/${contractId}`).then((r) =>
 r.json().then((d) => ({ ok: r.ok, d })),
 );
 if (!data.ok) throw new Error(data.d.error || 'Failed to load contract');
 setContract(data.d);
 setManagerIds(Array.isArray(data.d.managers) ? data.d.managers.map((m: { id: string }) => m.id) : []);
 setRemindersDisabled(!!data.d.remindersDisabled);
 setRenewEndDate(addMonths(data.d.endDate, 12));
 };

 const loadAttachments = async (contractId: string) => {
 const res = await fetch(`/api/people/contracts/${contractId}/attachments`);
 const data = await res.json().catch(() => []);
 if (!res.ok) throw new Error(data.error || 'Failed to load attachments');
 setAttachments(Array.isArray(data) ? data : []);
 };

 useEffect(() => {
 if (!id) return;
 setLoading(true);
 Promise.all([loadContract(id), loadAttachments(id)])
 .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load contract'))
 .finally(() => setLoading(false));
 }, [id]);

 useEffect(() => {
 fetch('/api/users?contractManagerPicker=1')
 .then((r) => (r.ok ? r.json() : []))
 .then((d) =>
 setAllUsers(Array.isArray(d) ? d.map((u) => ({ id: u.id, name: u.name, email: u.email })) : []),
 )
 .catch(() => setAllUsers([]));
 }, []);

 const saveSettings = async () => {
 if (!id) return;
 setSaving(true);
 setError(null);
 try {
 const res = await fetch(`/api/people/contracts/${id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ remindersDisabled, managerIds }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to save settings');
 await loadContract(id);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to save settings');
 } finally {
 setSaving(false);
 }
 };

 const renewContract = async () => {
 if (!id || !contract) return;
 setRenewing(true);
 setError(null);
 try {
 const start = new Date(`${contract.endDate}T12:00:00`);
 start.setDate(start.getDate() + 1);
 const res = await fetch(`/api/people/contracts/${id}/renew`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 newStartDate: start.toISOString().slice(0, 10),
 newEndDate: renewEndDate,
 }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to renew contract');
 window.location.href = `/dashboard/people/contracts/${data.id}`;
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to renew contract');
 } finally {
 setRenewing(false);
 }
 };

 const uploadAttachment = async (file: File) => {
 if (!id) return;
 setUploading(true);
 setError(null);
 try {
 const fd = new FormData();
 fd.append('file', file);
 const res = await fetch(`/api/people/contracts/${id}/attachments`, {
 method: 'POST',
 body: fd,
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to upload attachment');
 await loadAttachments(id);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to upload attachment');
 } finally {
 setUploading(false);
 }
 };

 const status = useMemo(() => (contract ? getStatus(contract.endDate) : null), [contract]);

 if (loading) {
 return (
 <div className="w-full min-w-0 dashboard-surface p-6 text-sm text-neutral-500">
 Loading contract...
 </div>
 );
 }

 if (!contract) {
 return (
 <div className="w-full min-w-0 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
 {error || 'Contract not found'}
 </div>
 );
 }

 return (
 <DashboardPage>
 <nav className="mb-4 sm:mb-5" aria-label="Breadcrumb">
 <ol className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-500">
 <li>
 <Link href="/dashboard/people/contracts" className="hover:text-primary-700 transition-colors">
 Contracts
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li className="text-primary-900 font-medium" aria-current="page">Contract detail</li>
 </ol>
 </nav>

 <div className="dashboard-surface p-5">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <DashboardPageHeader
 title={contract.title || 'Contract'}
 description={`${contract.contractType === 'consultant' ? 'Consultant doctor contract' : 'Employee contract'} · Ref: ${contract.reference || '—'}`}
 className="min-w-0 flex-1 !mb-0"
 />
 {status ? (
 <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
 {status.label}
 </span>
 ) : null}
 </div>

 <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
 <div className="rounded-lg border border-neutral-200 p-3">
 <p className="text-xs text-neutral-500">Start date</p>
 <p>{contract.startDate || '—'}</p>
 </div>
 <div className="rounded-lg border border-neutral-200 p-3">
 <p className="text-xs text-neutral-500">End date</p>
 <p>{contract.endDate}</p>
 </div>
 <div className="rounded-lg border border-neutral-200 p-3">
 <p className="text-xs text-neutral-500">Last updated</p>
 <p>{new Date(contract.updatedAt).toLocaleString()}</p>
 </div>
 </div>

 <div className="mt-5 rounded-lg border border-neutral-200 p-4">
 <p className="text-sm font-semibold text-neutral-900">Quick renew</p>
 <p className="mt-1 text-xs text-neutral-500">
 Creates a new contract starting the day after this one ends, carrying over managers.
 </p>
 <div className="mt-3 flex flex-wrap items-center gap-2">
 <input
 type="date"
 value={renewEndDate}
 onChange={(e) => setRenewEndDate(e.target.value)}
 className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 />
 <button
 type="button"
 onClick={renewContract}
 disabled={renewing || !renewEndDate}
 className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
 >
 {renewing ? 'Renewing...' : 'Renew contract'}
 </button>
 </div>
 </div>

 <div className="mt-5 rounded-lg border border-neutral-200 p-4">
 <p className="text-sm font-semibold text-neutral-900">Signed PDF attachments</p>
 <div className="mt-3 flex items-center gap-2">
 <input
 type="file"
 accept="application/pdf"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) void uploadAttachment(file);
 e.currentTarget.value = '';
 }}
 className="text-sm"
 />
 {uploading ? <span className="text-xs text-neutral-500">Uploading...</span> : null}
 </div>
 <div className="mt-3 space-y-2">
 {attachments.length === 0 ? (
 <p className="text-xs text-neutral-500">No signed documents uploaded yet.</p>
 ) : (
 attachments.map((a) => (
 <div key={a.name} className="flex items-center justify-between rounded border border-neutral-200 px-3 py-2 text-sm">
 <div>
 <p className="font-medium text-neutral-800">{a.originalName}</p>
 <p className="text-xs text-neutral-500">
 {(a.size / 1024 / 1024).toFixed(2)} MB · {new Date(a.uploadedAt).toLocaleString()}
 </p>
 </div>
 <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary-700 hover:underline">
 Open
 </a>
 </div>
 ))
 )}
 </div>
 </div>

 <div className="mt-5 rounded-lg border border-neutral-200 p-4">
 <p className="text-sm font-semibold text-neutral-900">Reminder and manager settings</p>
 <label className="mt-3 inline-flex items-center gap-2 text-sm text-neutral-700">
 <input
 type="checkbox"
 checked={remindersDisabled}
 onChange={(e) => setRemindersDisabled(e.target.checked)}
 />
 Disable expiry reminders for this contract
 </label>

 {allUsers.length ? (
 <div className="mt-4">
 <p className="mb-2 text-xs font-medium text-neutral-600">Contract managers</p>
 <div className="flex flex-wrap gap-2">
 {allUsers.map((u) => (
 <label
 key={u.id}
 className="inline-flex items-center gap-1 rounded border border-neutral-200 px-2 py-1 text-xs"
 >
 <input
 type="checkbox"
 checked={managerIds.includes(u.id)}
 onChange={(e) =>
 setManagerIds((prev) =>
 e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id),
 )
 }
 />
 {u.name}
 </label>
 ))}
 </div>
 </div>
 ) : null}

 {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
 <button
 type="button"
 onClick={saveSettings}
 disabled={saving}
 className="mt-4 rounded-lg bg-primary-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
 >
 {saving ? 'Saving...' : 'Save settings'}
 </button>
 </div>
 </div>
 </DashboardPage>
 );
}

