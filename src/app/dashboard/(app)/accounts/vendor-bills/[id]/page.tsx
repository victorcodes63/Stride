'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
 Loader2,
 AlertCircle,
 CheckCircle2,
 CircleDashed,
 CircleOff,
 Building2,
} from 'lucide-react';
import useEntityConfig, { useDisplayMoney } from '@/hooks/useEntityConfig';
import { EntityContextBanner } from '@/components/EntityContextBanner';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type Line = {
 id: string;
 lineNo: number;
 item: string;
 description: string | null;
 amountExVat: string;
};

type Allocation = {
 id: string;
 amount: number;
 paymentId: string;
 paidAt: string;
 reference: string | null;
 method: string | null;
};

type BillDetail = {
 id: string;
 vendorId: string;
 vendorName: string;
 billRef: string | null;
 issueDate: string;
 dueDate: string | null;
 currency: string;
 vatRateBps: number;
 status: string;
 notes: string | null;
 subtotalExVat: number;
 vatAmount: number;
 totalIncVat: number;
 allocatedTotal: number;
 balanceDue: number;
 canManageVendors: boolean;
 lines: Line[];
 allocations: Allocation[];
};

const STATUS_OPTIONS = [
 { value: 'unpaid' as const, label: 'Unpaid', Icon: CircleOff },
 { value: 'partial' as const, label: 'Partial', Icon: CircleDashed },
 { value: 'paid' as const, label: 'Paid', Icon: CheckCircle2 },
];

export default function VendorBillDetailPage() {
 const entityConfig = useEntityConfig();
 const displayMoney = useDisplayMoney();
 const params = useParams();
 const id = typeof params.id === 'string' ? params.id : '';
 const [data, setData] = useState<BillDetail | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [savingStatus, setSavingStatus] = useState(false);
 const [payAmount, setPayAmount] = useState('');
 const [payDate, setPayDate] = useState('');
 const [payReference, setPayReference] = useState('');
 const [payMethod, setPayMethod] = useState('');
 const [paySubmitting, setPaySubmitting] = useState(false);
 const [payError, setPayError] = useState<string | null>(null);

 const load = useCallback(() => {
 if (!id) return Promise.resolve();
 return fetch(`/api/accounts/vendor-bills/${id}`)
 .then(async (r) => {
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
 return j as BillDetail;
 })
 .then((bill) => {
 setData(bill);
 setError(null);
 const bal = Math.max(0, bill.balanceDue);
 setPayAmount(
 bal > 0
 ? bal.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
 : '',
 );
 const today = new Date();
 setPayDate(
 `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
 );
 })
 .catch((e) => {
 setError(e instanceof Error ? e.message : 'Failed to load');
 setData(null);
 });
 }, [id]);

 useEffect(() => {
 if (!id) {
 setLoading(false);
 setError('Invalid bill');
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

 const setBillStatus = async (status: string) => {
 if (!id || !data || status === data.status) return;
 setSavingStatus(true);
 try {
 const r = await fetch(`/api/accounts/vendor-bills/${id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ status }),
 });
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || 'Could not update status');
 await load();
 setError(null);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Update failed');
 } finally {
 setSavingStatus(false);
 }
 };

 const submitPayment = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!data || !id) return;
 setPayError(null);
 const normalized = payAmount.replace(/,/g, '').trim();
 const amt = parseFloat(normalized);
 if (!Number.isFinite(amt) || amt <= 0) {
 setPayError('Enter a positive payment amount.');
 return;
 }
 const rounded = Math.round(amt * 100) / 100;
 if (rounded > data.balanceDue + 0.02) {
 setPayError(`Amount exceeds balance due (${displayMoney(data.balanceDue, data.currency)}).`);
 return;
 }
 if (!payDate.trim()) {
 setPayError('Payment date is required.');
 return;
 }

 setPaySubmitting(true);
 try {
 const r = await fetch('/api/accounts/vendor-payments', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 vendorId: data.vendorId,
 paidAt: payDate.trim(),
 amount: rounded,
 reference: payReference.trim() || null,
 method: payMethod.trim() || null,
 notes: null,
 allocations: [{ billId: id, amount: rounded }],
 }),
 });
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || 'Payment failed');
 setPayReference('');
 await load();
 } catch (err) {
 setPayError(err instanceof Error ? err.message : 'Payment failed');
 } finally {
 setPaySubmitting(false);
 }
 };

 if (loading) {
 return (
 <div className="flex items-center gap-2 text-neutral-600 py-12">
 <Loader2 className="w-5 h-5 animate-spin" />
 Loading bill…
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
 <Link href="/dashboard/accounts/vendor-bills" className="hover:text-primary-700 transition-colors">
 Vendor bills
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
 <nav className="mb-4 print:hidden" aria-label="Breadcrumb">
 <ol className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-500">
 <li>
 <Link href="/dashboard/accounts" className="hover:text-primary-700 transition-colors">
 Accounts
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li>
 <Link href="/dashboard/accounts/vendor-bills" className="hover:text-primary-700 transition-colors">
 Vendor bills
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li className="text-primary-900 font-medium truncate max-w-[10rem]" aria-current="page">
 {data.billRef || data.id.slice(0, 8)}
 </li>
 </ol>
 </nav>

 <div className="print:hidden mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
 <DashboardPageHeader
 title={data.billRef ? `Vendor bill · ${data.billRef}` : 'Vendor bill'}
 description={
 <>
 <Link
 href={`/dashboard/accounts/vendors/${data.vendorId}`}
 className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-800 hover:underline"
 >
 <Building2 className="w-4 h-4" />
 {data.vendorName}
 </Link>
 <EntityContextBanner />
 </>
 }
 className="min-w-0 flex-1 !mb-0"
 />

 <div
 className="lg:max-w-md w-full lg:w-auto lg:min-w-[280px] dashboard-surface px-4 py-3 shadow-sm"
 role="region"
 aria-label="Bill payment status"
 >
 <div className="flex items-center justify-between gap-3 mb-2">
 <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Ledger status</p>
 {savingStatus ? (
 <span className="text-xs text-neutral-500 inline-flex items-center gap-1 shrink-0">
 <Loader2 className="w-3.5 h-3.5 animate-spin" />
 Saving
 </span>
 ) : null}
 </div>
 {data.canManageVendors ? (
 <div className="flex rounded-lg border border-neutral-200 bg-neutral-50/80 p-1 gap-1" role="group">
 {STATUS_OPTIONS.map(({ value, label, Icon }) => {
 const active = data.status === value;
 return (
 <button
 key={value}
 type="button"
 disabled={savingStatus}
 onClick={() => void setBillStatus(value)}
 className={[
 'flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-semibold transition-all min-w-0',
 active
 ? value === 'paid'
 ? 'bg-emerald-600 text-white shadow-sm'
 : value === 'partial'
 ? 'bg-amber-500 text-white shadow-sm'
 : 'bg-primary-900 text-white shadow-sm'
 : 'bg-transparent text-neutral-600 hover:bg-white hover:text-neutral-900 border border-transparent',
 savingStatus ? 'opacity-60 cursor-not-allowed' : '',
 ].join(' ')}
 >
 <Icon className="w-3.5 h-3.5 shrink-0 opacity-90" aria-hidden />
 <span className="truncate">{label}</span>
 </button>
 );
 })}
 </div>
 ) : (
 <p className="text-sm font-medium text-neutral-900 capitalize">{data.status}</p>
 )}
 <p className="text-[11px] text-neutral-500 mt-2 leading-snug">
 Status updates from payments below; you can override for bookkeeping if needed.
 </p>
 </div>
 </div>

 <div className="dashboard-surface shadow-sm overflow-hidden mb-6">
 <div className="px-5 py-4 border-b border-neutral-100 flex flex-wrap justify-between gap-3">
 <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
 <div>
 <dt className="text-neutral-500 text-xs uppercase tracking-wide">Issued</dt>
 <dd className="font-medium tabular-nums">{data.issueDate}</dd>
 </div>
 <div>
 <dt className="text-neutral-500 text-xs uppercase tracking-wide">Due</dt>
 <dd className="font-medium tabular-nums">{data.dueDate ?? '—'}</dd>
 </div>
 <div>
 <dt className="text-neutral-500 text-xs uppercase tracking-wide">Allocated</dt>
 <dd className="font-medium tabular-nums">{displayMoney(data.allocatedTotal, data.currency)}</dd>
 </div>
 <div>
 <dt className="text-neutral-500 text-xs uppercase tracking-wide">Balance</dt>
 <dd className="font-semibold text-primary-900 tabular-nums">
 {displayMoney(Math.max(0, data.balanceDue), data.currency)}
 </dd>
 </div>
 </dl>
 </div>

 {data.notes?.trim() ? (
 <div className="px-5 py-3 border-b border-neutral-100 bg-neutral-50/50 text-sm">
 <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Notes</p>
 <p className="text-neutral-800 whitespace-pre-wrap">{data.notes.trim()}</p>
 </div>
 ) : null}

 <div className="px-5 py-4">
 <h2 className="text-sm font-bold text-primary-900 mb-3">Lines</h2>
 <div className="border border-neutral-200 rounded-lg overflow-hidden">
 <table className="data-table dashboard-data-table w-full text-sm">
 <thead>
 <tr className="bg-neutral-100 border-b border-neutral-200 text-neutral-600">
 <th className="py-2 px-3 text-left w-10">#</th>
 <th className="py-2 px-3 text-left">Item</th>
 <th className="py-2 px-3 text-right whitespace-nowrap">Amount ({data.currency})</th>
 </tr>
 </thead>
 <tbody>
 {data.lines.map((l) => (
 <tr key={l.id} className="border-b border-neutral-100 last:border-0">
 <td className="py-3 px-3 text-neutral-600 tabular-nums">{l.lineNo}</td>
 <td className="py-3 px-3">
 <span className="font-semibold text-neutral-900 block">{l.item}</span>
 {l.description?.trim() ? (
 <span className="text-xs text-neutral-600">{l.description.trim()}</span>
 ) : null}
 </td>
 <td className="py-3 px-3 text-right tabular-nums font-medium">
 {displayMoney(Number(l.amountExVat), data.currency)}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <div className="mt-4 flex justify-end">
 <div className="w-full max-w-xs border border-neutral-200 rounded-lg p-4 text-sm space-y-2">
 <div className="flex justify-between text-neutral-700">
 <span>Subtotal ex-VAT</span>
 <span className="tabular-nums">{displayMoney(data.subtotalExVat, data.currency)}</span>
 </div>
 <div className="flex justify-between text-neutral-700">
 <span>{entityConfig.tax.vatLabel}</span>
 <span className="tabular-nums">{displayMoney(data.vatAmount, data.currency)}</span>
 </div>
 <div className="flex justify-between font-bold text-primary-900 pt-2 border-t border-neutral-200">
 <span>Total</span>
 <span className="tabular-nums">{displayMoney(data.totalIncVat, data.currency)}</span>
 </div>
 </div>
 </div>
 </div>
 </div>

 {data.allocations.length > 0 && (
 <section className="mb-6 dashboard-surface p-5 shadow-sm">
 <h2 className="text-sm font-bold text-primary-900 mb-3">Allocations</h2>
 <ul className="divide-y divide-neutral-100 text-sm">
 {data.allocations.map((a) => (
 <li key={a.id} className="py-2 flex flex-wrap justify-between gap-2">
 <span className="text-neutral-600">
 {a.paidAt}
 {a.reference ? ` · ${a.reference}` : ''}
 {a.method ? ` · ${a.method}` : ''}
 </span>
 <span className="font-medium tabular-nums">{displayMoney(a.amount, data.currency)}</span>
 </li>
 ))}
 </ul>
 </section>
 )}

 {data.canManageVendors && data.balanceDue > 0.005 && (
 <section className="dashboard-surface p-5 shadow-sm max-w-lg">
 <h2 className="text-sm font-bold text-primary-900 mb-3">Apply payment to this bill</h2>
 {payError && (
 <div className="mb-3 text-sm text-red-800 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
 {payError}
 </div>
 )}
 <form onSubmit={submitPayment} className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label htmlFor="payDate" className="block text-xs font-medium text-neutral-600 mb-1">
 Paid on
 </label>
 <input
 id="payDate"
 type="date"
 required
 className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 value={payDate}
 onChange={(e) => setPayDate(e.target.value)}
 />
 </div>
 <div>
 <label htmlFor="payAmount" className="block text-xs font-medium text-neutral-600 mb-1">
 Amount ({data.currency})
 </label>
 <input
 id="payAmount"
 className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tabular-nums"
 value={payAmount}
 onChange={(e) => setPayAmount(e.target.value)}
 required
 />
 </div>
 </div>
 <div>
 <label htmlFor="payRef" className="block text-xs font-medium text-neutral-600 mb-1">
 Reference
 </label>
 <input
 id="payRef"
 className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 value={payReference}
 onChange={(e) => setPayReference(e.target.value)}
 placeholder="Bank ref / Mpesa code"
 />
 </div>
 <div>
 <label htmlFor="payMethod" className="block text-xs font-medium text-neutral-600 mb-1">
 Method
 </label>
 <input
 id="payMethod"
 className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 value={payMethod}
 onChange={(e) => setPayMethod(e.target.value)}
 placeholder="e.g. Bank, Mpesa"
 />
 </div>
 <button
 type="submit"
 disabled={paySubmitting}
 className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-60"
 >
 {paySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
 Record payment
 </button>
 </form>
 </section>
 )}
 </DashboardPage>
 );
}
