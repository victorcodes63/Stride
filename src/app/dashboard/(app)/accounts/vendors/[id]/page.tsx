'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
 AlertCircle,
 Loader2,
 Plus,
 FileText,
 Pencil,
 Check,
 X,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type BillSummary = {
 id: string;
 billRef: string | null;
 issueDate: string;
 dueDate: string | null;
 currency: string;
 status: string;
 totalIncVat: number;
 lineCount: number;
};

type PaymentSummary = {
 id: string;
 paidAt: string;
 amount: number;
 reference: string | null;
 method: string | null;
};

type VendorDetail = {
 id: string;
 name: string;
 contactName: string | null;
 contactEmail: string | null;
 contactPhone: string | null;
 currency: string;
 notes: string | null;
 canManageVendors: boolean;
 bills: BillSummary[];
 payments: PaymentSummary[];
};

function money(n: number, currency: string) {
 return `${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

const inputClass =
 'w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30';

export default function VendorDetailPage() {
 const params = useParams();
 const router = useRouter();
 const id = typeof params.id === 'string' ? params.id : '';
 const [data, setData] = useState<VendorDetail | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [editing, setEditing] = useState(false);
 const [saving, setSaving] = useState(false);
 const [draft, setDraft] = useState({
 name: '',
 currency: 'KES',
 contactName: '',
 contactEmail: '',
 contactPhone: '',
 notes: '',
 });

 const load = useCallback(() => {
 if (!id) return Promise.resolve();
 return fetch(`/api/accounts/vendors/${id}`)
 .then(async (r) => {
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
 return j as VendorDetail;
 })
 .then((v) => {
 setData(v);
 setDraft({
 name: v.name,
 currency: v.currency,
 contactName: v.contactName ?? '',
 contactEmail: v.contactEmail ?? '',
 contactPhone: v.contactPhone ?? '',
 notes: v.notes ?? '',
 });
 setError(null);
 })
 .catch((e) => {
 setError(e instanceof Error ? e.message : 'Failed to load');
 setData(null);
 });
 }, [id]);

 useEffect(() => {
 if (!id) {
 setLoading(false);
 setError('Invalid vendor');
 return;
 }
 let cancelled = false;
 setLoading(true);
 load().finally(() => {
 if (!cancelled) setLoading(false);
 });
 return () => {
 cancelled = true;
 };
 }, [id, load]);

 const saveProfile = async () => {
 if (!id || !data?.canManageVendors) return;
 setSaving(true);
 setError(null);
 try {
 const r = await fetch(`/api/accounts/vendors/${id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 name: draft.name.trim(),
 currency: draft.currency.trim() || 'KES',
 contactName: draft.contactName.trim() || null,
 contactEmail: draft.contactEmail.trim() || null,
 contactPhone: draft.contactPhone.trim() || null,
 notes: draft.notes.trim() || null,
 }),
 });
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || 'Could not save');
 setEditing(false);
 await load();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Save failed');
 } finally {
 setSaving(false);
 }
 };

 if (loading) {
 return (
 <div className="flex items-center gap-2 text-neutral-600 py-12">
 <Loader2 className="w-5 h-5 animate-spin" />
 Loading vendor…
 </div>
 );
 }

 if (error || !data) {
 return (
 <DashboardPage>
 <nav className="mb-4" aria-label="Breadcrumb">
 <ol className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-500">
 <li>
 <Link href="/dashboard/accounts" className="hover:text-primary-700 transition-colors">
 Accounts
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li>
 <Link href="/dashboard/accounts/vendors" className="hover:text-primary-700 transition-colors">
 Vendors
 </Link>
 </li>
 </ol>
 </nav>
 <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 flex gap-2">
 <AlertCircle className="w-5 h-5 shrink-0" />
 {error || 'Not found'}
 </div>
 </DashboardPage>
 );
 }

 return (
 <DashboardPage>
 <nav className="mb-4" aria-label="Breadcrumb">
 <ol className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-500">
 <li>
 <Link href="/dashboard/accounts" className="hover:text-primary-700 transition-colors">
 Accounts
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li>
 <Link href="/dashboard/accounts/vendors" className="hover:text-primary-700 transition-colors">
 Vendors
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li className="text-primary-900 font-medium truncate max-w-[12rem] sm:max-w-md" aria-current="page">
 {data.name}
 </li>
 </ol>
 </nav>

 <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
 <DashboardPageHeader
 title={data.name}
 description={
 <>Default currency <span className="font-medium text-neutral-800">{data.currency}</span></>
 }
 actions={
 <Link
 href={`/dashboard/accounts/vendor-bills/new?vendorId=${encodeURIComponent(id)}`}
 className="btn-primary inline-flex items-center gap-2"
 >
 <Plus className="w-4 h-4" />
 New bill
 </Link>
 }
 className="min-w-0 flex-1 !mb-0"
 />
 </div>

 {error && !loading && (
 <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
 {error}
 </div>
 )}

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
 <section className="dashboard-surface p-5 shadow-sm">
 <div className="flex items-center justify-between gap-2 mb-4">
 <h2 className="text-sm font-bold text-primary-900 uppercase tracking-wide">Profile</h2>
 {data.canManageVendors && !editing && (
 <button
 type="button"
 onClick={() => setEditing(true)}
 className="inline-flex items-center gap-1 text-sm font-medium text-primary-800 hover:underline"
 >
 <Pencil className="w-4 h-4" />
 Edit
 </button>
 )}
 {data.canManageVendors && editing && (
 <div className="flex gap-1">
 <button
 type="button"
 onClick={() => void saveProfile()}
 disabled={saving}
 className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary-900 text-white text-xs font-semibold disabled:opacity-60"
 >
 <Check className="w-3.5 h-3.5" />
 Save
 </button>
 <button
 type="button"
 onClick={() => {
 setEditing(false);
 setDraft({
 name: data.name,
 currency: data.currency,
 contactName: data.contactName ?? '',
 contactEmail: data.contactEmail ?? '',
 contactPhone: data.contactPhone ?? '',
 notes: data.notes ?? '',
 });
 }}
 className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-300 text-xs font-medium"
 >
 <X className="w-3.5 h-3.5" />
 Cancel
 </button>
 </div>
 )}
 </div>

 {!editing ? (
 <dl className="space-y-2 text-sm">
 <div>
 <dt className="text-neutral-500">Contact</dt>
 <dd className="text-neutral-900">
 {[data.contactName, data.contactEmail, data.contactPhone].filter(Boolean).join(' · ') || '—'}
 </dd>
 </div>
 {data.notes?.trim() ? (
 <div>
 <dt className="text-neutral-500">Notes</dt>
 <dd className="text-neutral-800 whitespace-pre-wrap">{data.notes.trim()}</dd>
 </div>
 ) : null}
 </dl>
 ) : (
 <div className="space-y-3">
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Name</label>
 <input
 className={inputClass}
 value={draft.name}
 onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Currency</label>
 <input
 className={inputClass}
 value={draft.currency}
 onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value.toUpperCase() }))}
 />
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 <input
 className={inputClass}
 placeholder="Contact name"
 value={draft.contactName}
 onChange={(e) => setDraft((d) => ({ ...d, contactName: e.target.value }))}
 />
 <input
 className={inputClass}
 placeholder="Email"
 value={draft.contactEmail}
 onChange={(e) => setDraft((d) => ({ ...d, contactEmail: e.target.value }))}
 />
 </div>
 <input
 className={inputClass}
 placeholder="Phone"
 value={draft.contactPhone}
 onChange={(e) => setDraft((d) => ({ ...d, contactPhone: e.target.value }))}
 />
 <textarea
 className={inputClass}
 rows={3}
 placeholder="Notes"
 value={draft.notes}
 onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
 />
 </div>
 )}
 </section>

 <section className="dashboard-surface p-5 shadow-sm">
 <h2 className="text-sm font-bold text-primary-900 uppercase tracking-wide mb-3">Recent payments</h2>
 {data.payments.length === 0 ? (
 <p className="text-sm text-neutral-500">No payments yet. Record a payment from a bill detail page.</p>
 ) : (
 <ul className="divide-y divide-neutral-100 text-sm">
 {data.payments.map((p) => (
 <li key={p.id} className="py-2 flex justify-between gap-3">
 <span className="text-neutral-600 tabular-nums">{p.paidAt}</span>
 <span className="font-medium text-neutral-900 tabular-nums">
 {money(p.amount, data.currency)}
 </span>
 </li>
 ))}
 </ul>
 )}
 </section>
 </div>

 <section className="dashboard-surface shadow-sm overflow-hidden">
 <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between gap-2">
 <h2 className="text-sm font-bold text-primary-900 uppercase tracking-wide flex items-center gap-2">
 <FileText className="w-4 h-4" />
 Bills
 </h2>
 <Link
 href={`/dashboard/accounts/vendor-bills?vendorId=${encodeURIComponent(id)}`}
 className="text-sm font-medium text-primary-800 hover:underline"
 >
 View in list
 </Link>
 </div>
 {data.bills.length === 0 ? (
 <div className="p-8 text-center text-sm text-neutral-600">
 No bills yet.{' '}
 <Link
 href={`/dashboard/accounts/vendor-bills/new?vendorId=${encodeURIComponent(id)}`}
 className="font-medium text-primary-800 underline"
 >
 Create a bill
 </Link>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full min-w-[720px] text-sm">
 <thead>
 <tr className="border-b border-neutral-200 bg-neutral-50/90">
 <th className="text-left px-4 py-3 font-semibold text-neutral-700">Reference</th>
 <th className="text-left px-4 py-3 font-semibold text-neutral-700">Issued</th>
 <th className="text-left px-4 py-3 font-semibold text-neutral-700">Due</th>
 <th className="text-right px-4 py-3 font-semibold text-neutral-700">Total</th>
 <th className="text-left px-4 py-3 font-semibold text-neutral-700">Status</th>
 </tr>
 </thead>
 <tbody>
 {data.bills.map((bill, index) => (
 <tr
 key={bill.id}
 role="link"
 tabIndex={0}
 onClick={() => router.push(`/dashboard/accounts/vendor-bills/${bill.id}`)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 router.push(`/dashboard/accounts/vendor-bills/${bill.id}`);
 }
 }}
 className="cursor-pointer border-b border-neutral-100 transition-colors"
 >
 <td className="px-4 py-3 font-medium text-primary-800">
 {bill.billRef || bill.id.slice(0, 8)}
 </td>
 <td className="px-4 py-3 text-neutral-600 tabular-nums">{bill.issueDate}</td>
 <td className="px-4 py-3 text-neutral-600 tabular-nums">{bill.dueDate ?? '—'}</td>
 <td className="px-4 py-3 text-right tabular-nums font-semibold text-neutral-900">
 {money(bill.totalIncVat, bill.currency)}
 </td>
 <td className="px-4 py-3">
 <span
 className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
 bill.status === 'paid'
 ? 'bg-emerald-50 text-emerald-800'
 : bill.status === 'partial'
 ? 'bg-amber-50 text-amber-800'
 : 'bg-neutral-100 text-neutral-700'
 }`}
 >
 {bill.status}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </section>
 </DashboardPage>
 );
}
