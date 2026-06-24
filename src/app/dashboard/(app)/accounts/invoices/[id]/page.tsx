'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
 Loader2,
 AlertCircle,
 Printer,
 Download,
 Eye,
 CheckCircle2,
 CircleDashed,
 CircleOff,
 FileMinus2,
} from 'lucide-react';
import {
 InvoiceBankDisplay,
 InvoicePaymentAccountSelect,
} from '@/components/accounts/InvoiceBankPanel';
import {
 paymentAccountToDetails,
 type PaymentAccountRow,
} from '@/lib/payment-accounts';
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

type CreditNoteSummary = {
 id: string;
 creditNoteNumber: number;
 issueDate: string;
 totalIncVat: number;
};

type InvoiceDetail = {
 id: string;
 invoiceNumber: number;
 clientName: string;
 issueDate: string;
 dueDate: string | null;
 taxDate: string | null;
 currency: string;
 vatRateBps: number;
 status: string;
 canSetInvoiceStatus?: boolean;
 canEditInvoice?: boolean;
 canIssueCreditNote?: boolean;
 creditTotalApplied?: number;
 remainingCreditable?: number;
 creditNotes?: CreditNoteSummary[];
 paymentAccountId: string | null;
 paymentBank: string;
 notes: string | null;
 totalOverrideIncVat?: number | null;
 subtotalExVat: number;
 vatAmount: number;
 totalIncVat: number;
 lines: Line[];
};

function computeInvoiceTotalFromSubtotal(subtotalExVat: number, vatRateBps: number): number {
 const rate = vatRateBps / 10000;
 const vatAmount = Math.round(subtotalExVat * rate * 100) / 100;
 return Math.round((subtotalExVat + vatAmount) * 100) / 100;
}

function findRoundingAdjustmentExVat(
 subtotalExVat: number,
 vatRateBps: number,
 targetTotal: number,
): { adjExVat: number; achievedTotal: number; hitsTarget: boolean } | null {
 let closestAbove: { adjExVat: number; achievedTotal: number } | null = null;
 for (let cents = 1; cents <= 2000; cents++) {
 const adj = cents / 100;
 const total = computeInvoiceTotalFromSubtotal(subtotalExVat + adj, vatRateBps);
 if (Math.abs(total - targetTotal) < 0.00001) {
 return { adjExVat: adj, achievedTotal: total, hitsTarget: true };
 }
 if (total > targetTotal) {
 if (!closestAbove || total < closestAbove.achievedTotal) {
 closestAbove = { adjExVat: adj, achievedTotal: total };
 }
 }
 }
 return closestAbove ? { ...closestAbove, hitsTarget: false } : null;
}

const STATUS_OPTIONS = [
 { value: 'unpaid' as const, label: 'Unpaid', Icon: CircleOff },
 { value: 'partial' as const, label: 'Partial', Icon: CircleDashed },
 { value: 'paid' as const, label: 'Paid', Icon: CheckCircle2 },
];

export default function AccountsInvoiceDetailPage() {
 const entityConfig = useEntityConfig();
 const displayMoney = useDisplayMoney();
 const params = useParams();
 const id = typeof params.id === 'string' ? params.id : '';
 const [data, setData] = useState<InvoiceDetail | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [savingBank, setSavingBank] = useState(false);
 const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountRow[]>([]);
 const [paymentAccountsLoading, setPaymentAccountsLoading] = useState(true);
 const [savingStatus, setSavingStatus] = useState(false);
 const [savingEdit, setSavingEdit] = useState(false);
 const [isEditing, setIsEditing] = useState(false);
 const [editRoundToWholeKes, setEditRoundToWholeKes] = useState(false);
 const [editForm, setEditForm] = useState<{
 issueDate: string;
 dueDate: string;
 taxDate: string;
 vatRateBps: number;
 notes: string;
 totalOverrideIncVat: string;
 lines: Array<{ item: string; description: string; amountExVat: string }>;
 } | null>(null);

 const load = useCallback(() => {
 if (!id) return Promise.resolve();
 return fetch(`/api/accounts/invoices/${id}`)
 .then(async (r) => {
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
 return j as InvoiceDetail;
 })
 .then((inv) => {
 setData(inv);
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
 setError('Invalid invoice');
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

 useEffect(() => {
 setPaymentAccountsLoading(true);
 fetch('/api/accounts/payment-accounts?activeOnly=1')
 .then(async (r) => {
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
 return j as { accounts?: PaymentAccountRow[] };
 })
 .then((payload) => {
 setPaymentAccounts(Array.isArray(payload.accounts) ? payload.accounts : []);
 })
 .catch(() => setPaymentAccounts([]))
 .finally(() => setPaymentAccountsLoading(false));
 }, []);

 const effectivePaymentAccountId = useMemo(() => {
 if (!data) return '';
 if (data.paymentAccountId) return data.paymentAccountId;
 return paymentAccounts.find((a) => a.legacyKind === data.paymentBank)?.id ?? '';
 }, [data, paymentAccounts]);

 const paymentDetails = useMemo(() => {
 if (!data) return null;
 const account =
 paymentAccounts.find((a) => a.id === effectivePaymentAccountId) ??
 paymentAccounts.find((a) => a.legacyKind === data.paymentBank);
 return account ? paymentAccountToDetails(account) : null;
 }, [data, paymentAccounts, effectivePaymentAccountId]);

 useEffect(() => {
 if (!data) return;
 setEditForm({
 issueDate: data.issueDate,
 dueDate: data.dueDate ?? '',
 taxDate: data.taxDate ?? '',
 vatRateBps: data.vatRateBps,
 notes: data.notes ?? '',
 totalOverrideIncVat:
 data.totalOverrideIncVat != null ? String(Number(data.totalOverrideIncVat)) : '',
 lines: data.lines.map((l) => ({
 item: l.item,
 description: l.description ?? '',
 amountExVat: String(Number(l.amountExVat)),
 })),
 });
 }, [data]);

 const editRoundingPreview = useMemo(() => {
 if (!editForm) return null;
 const subtotal = editForm.lines.reduce((sum, l) => {
 const n = parseFloat(l.amountExVat);
 return Number.isFinite(n) && n > 0 ? sum + n : sum;
 }, 0);
 if (subtotal <= 0) return null;
 const total = computeInvoiceTotalFromSubtotal(subtotal, editForm.vatRateBps);
 const hasFraction = Math.abs(total - Math.round(total)) > 0.00001;
 if (!hasFraction) return null;
 const targetTotal = Math.ceil(total);
 const rounding = findRoundingAdjustmentExVat(
 subtotal,
 editForm.vatRateBps,
 targetTotal,
 );
 if (!rounding) return null;
 return { subtotal, total, targetTotal, ...rounding };
 }, [editForm]);

 const editManualTotalOverride = useMemo(() => {
 if (!editForm) return null;
 const n = parseFloat(editForm.totalOverrideIncVat);
 if (!Number.isFinite(n) || n <= 0) return null;
 return Math.round(n * 100) / 100;
 }, [editForm]);

 const setInvoiceStatus = async (status: string) => {
 if (!id || !data || status === data.status) return;
 setSavingStatus(true);
 try {
 const r = await fetch(`/api/accounts/invoices/${id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ status }),
 });
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || 'Could not update status');
 setData((prev) => (prev ? { ...prev, status } : prev));
 setError(null);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Update failed');
 } finally {
 setSavingStatus(false);
 }
 };

 const setPaymentAccount = async (paymentAccountId: string) => {
 if (!id || !data || paymentAccountId === effectivePaymentAccountId) return;
 setSavingBank(true);
 try {
 const r = await fetch(`/api/accounts/invoices/${id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ paymentAccountId }),
 });
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || 'Could not update');
 setData((prev) =>
 prev
 ? {
 ...prev,
 paymentAccountId,
 paymentBank: typeof j.paymentBank === 'string' ? j.paymentBank : prev.paymentBank,
 }
 : prev,
 );
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Update failed');
 } finally {
 setSavingBank(false);
 }
 };

 const saveInvoiceEdits = async () => {
 if (!id || !editForm) return;
 setSavingEdit(true);
 try {
 const payload = {
 issueDate: editForm.issueDate,
 dueDate: editForm.dueDate || null,
 taxDate: editForm.taxDate || null,
 vatRateBps: editForm.vatRateBps,
 notes: editForm.notes,
 totalOverrideIncVat: editManualTotalOverride,
 lines: editForm.lines.map((l) => ({
 item: l.item,
 description: l.description || null,
 amountExVat: Number(l.amountExVat),
 })),
 };
 if (editRoundToWholeKes && editRoundingPreview) {
 payload.lines.push({
 item: 'Rounding adjustment',
 description: `Auto-added to round invoice total (incl. VAT) to whole ${entityConfig.currency.code} for ${entityConfig.payroll.taxAuthority} filing alignment.`,
 amountExVat: editRoundingPreview.adjExVat,
 });
 }
 const r = await fetch(`/api/accounts/invoices/${id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || 'Could not update invoice');
 await load();
 setIsEditing(false);
 setError(null);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Update failed');
 } finally {
 setSavingEdit(false);
 }
 };

 if (loading) {
 return (
 <div className="flex items-center gap-2 text-neutral-600 py-12">
 <Loader2 className="w-5 h-5 animate-spin" />
 Loading invoice…
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
 <Link href="/dashboard/accounts/invoices" className="hover:text-primary-700 transition-colors">
 Invoices
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
 <div className="print:hidden mb-6 space-y-4">
 <nav aria-label="Breadcrumb">
 <ol className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-500">
 <li>
 <Link href="/dashboard/accounts" className="hover:text-primary-700 transition-colors">
 Accounts
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li>
 <Link href="/dashboard/accounts/invoices" className="hover:text-primary-700 transition-colors">
 Invoices
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li className="text-primary-900 font-medium" aria-current="page">
 Invoice #{data.invoiceNumber}
 </li>
 </ol>
 </nav>
 <DashboardPageHeader
 title={`Invoice #${data.invoiceNumber}`}
 description={
 <>
 {data.clientName}
 <EntityContextBanner />
 </>
 }
 />
 <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
 <div className="flex flex-wrap gap-2">
 <button
 type="button"
 onClick={() => window.print()}
 className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-900 text-white text-sm font-medium hover:bg-primary-800 transition-colors"
 >
 <Printer className="w-4 h-4" />
 Print / Save as PDF
 </button>
 <a
 href={`/api/accounts/invoices/${id}/pdf?disposition=inline`}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 bg-white text-sm font-medium text-neutral-800 hover:bg-neutral-50 transition-colors"
 >
 <Eye className="w-4 h-4" />
 Preview PDF
 </a>
 <a
 href={`/api/accounts/invoices/${id}/pdf`}
 download
 className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 bg-white text-sm font-medium text-neutral-800 hover:bg-neutral-50 transition-colors"
 >
 <Download className="w-4 h-4" />
 Download PDF
 </a>
 </div>

 <div
 className="lg:max-w-md w-full lg:w-auto lg:min-w-[280px] dashboard-surface px-4 py-3 shadow-sm"
 role="region"
 aria-label="Invoice ledger status"
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
 {data.canSetInvoiceStatus ? (
 <div className="flex rounded-lg border border-neutral-200 bg-neutral-50/80 p-1 gap-1" role="group">
 {STATUS_OPTIONS.map(({ value, label, Icon }) => {
 const active = data.status === value;
 return (
 <button
 key={value}
 type="button"
 disabled={savingStatus}
 onClick={() => void setInvoiceStatus(value)}
 className={[
 'flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-semibold transition-all min-w-0',
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
 <div className="space-y-1">
 <p className="text-sm font-medium text-neutral-900 capitalize">{data.status}</p>
 <p className="text-xs text-neutral-500 leading-relaxed">
 Your role can view status only. When receipts and allocations are enabled, this can update from
 recorded payments automatically.
 </p>
 </div>
 )}
 </div>
 </div>
 <InvoicePaymentAccountSelect
 accounts={paymentAccounts}
 value={effectivePaymentAccountId}
 onChange={setPaymentAccount}
 saving={savingBank}
 loading={paymentAccountsLoading}
 />
 {data.canEditInvoice && editForm ? (
 <div className="dashboard-surface px-4 py-4 text-sm space-y-3 print:hidden">
 <div className="flex items-center justify-between gap-3">
 <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Edit invoice</p>
 {!isEditing ? (
 <button
 type="button"
 onClick={() => setIsEditing(true)}
 className="px-3 py-1.5 rounded-md border border-neutral-300 text-xs font-medium hover:bg-neutral-50"
 >
 Edit
 </button>
 ) : null}
 </div>
 {isEditing ? (
 <div className="space-y-3">
 <div className="grid sm:grid-cols-3 gap-3">
 <label className="text-xs text-neutral-600">
 Issue date
 <input
 type="date"
 className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
 value={editForm.issueDate}
 onChange={(e) => setEditForm((f) => (f ? { ...f, issueDate: e.target.value } : f))}
 />
 </label>
 <label className="text-xs text-neutral-600">
 Due date
 <input
 type="date"
 className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
 value={editForm.dueDate}
 onChange={(e) => setEditForm((f) => (f ? { ...f, dueDate: e.target.value } : f))}
 />
 </label>
 <label className="text-xs text-neutral-600">
 Tax date
 <input
 type="date"
 className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
 value={editForm.taxDate}
 onChange={(e) => setEditForm((f) => (f ? { ...f, taxDate: e.target.value } : f))}
 />
 </label>
 </div>
 <div className="grid sm:grid-cols-2 gap-3">
 <label className="text-xs text-neutral-600">
 {entityConfig.tax.vatLabel} rate (%)
 <input
 type="number"
 min={0}
 max={500}
 step={0.01}
 className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
 value={editForm.vatRateBps / 100}
 onChange={(e) =>
 setEditForm((f) =>
 f ? { ...f, vatRateBps: Math.round((parseFloat(e.target.value || '0') || 0) * 100) } : f
 )
 }
 />
 </label>
 <label className="text-xs text-neutral-600">
 Notes
 <input
 type="text"
 className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
 value={editForm.notes}
 onChange={(e) => setEditForm((f) => (f ? { ...f, notes: e.target.value } : f))}
 />
 </label>
 <label className="text-xs text-neutral-600">
 Final total override (incl. VAT)
 <input
 type="number"
 min={0}
 step={0.01}
 className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5"
 value={editForm.totalOverrideIncVat}
 onChange={(e) =>
 setEditForm((f) => (f ? { ...f, totalOverrideIncVat: e.target.value } : f))
 }
 placeholder="Optional (e.g. 450000.00)"
 />
 </label>
 </div>
 <div className="space-y-2">
 {editForm.lines.map((line, idx) => (
 <div key={idx} className="grid grid-cols-12 gap-2">
 <input
 className="col-span-4 rounded-md border border-neutral-300 px-2 py-1.5"
 placeholder="Item"
 value={line.item}
 onChange={(e) =>
 setEditForm((f) =>
 f
 ? {
 ...f,
 lines: f.lines.map((l, i) => (i === idx ? { ...l, item: e.target.value } : l)),
 }
 : f
 )
 }
 />
 <input
 className="col-span-5 rounded-md border border-neutral-300 px-2 py-1.5"
 placeholder="Description"
 value={line.description}
 onChange={(e) =>
 setEditForm((f) =>
 f
 ? {
 ...f,
 lines: f.lines.map((l, i) => (i === idx ? { ...l, description: e.target.value } : l)),
 }
 : f
 )
 }
 />
 <input
 type="number"
 min={0.01}
 step={0.01}
 className="col-span-2 rounded-md border border-neutral-300 px-2 py-1.5"
 placeholder="Amount"
 value={line.amountExVat}
 onChange={(e) =>
 setEditForm((f) =>
 f
 ? {
 ...f,
 lines: f.lines.map((l, i) => (i === idx ? { ...l, amountExVat: e.target.value } : l)),
 }
 : f
 )
 }
 />
 <button
 type="button"
 className="col-span-1 text-xs text-red-700"
 onClick={() =>
 setEditForm((f) =>
 f && f.lines.length > 1
 ? { ...f, lines: f.lines.filter((_, i) => i !== idx) }
 : f
 )
 }
 >
 x
 </button>
 </div>
 ))}
 <button
 type="button"
 className="text-xs font-medium text-primary-800"
 onClick={() =>
 setEditForm((f) =>
 f
 ? {
 ...f,
 lines: [...f.lines, { item: '', description: '', amountExVat: '' }],
 }
 : f
 )
 }
 >
 + Add line
 </button>
 <div className="mt-2 rounded-lg border border-primary-100 bg-primary-50/50 px-3 py-2 space-y-1">
 <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
 <input
 type="checkbox"
 checked={editRoundToWholeKes}
 disabled={!editRoundingPreview}
 onChange={(e) => setEditRoundToWholeKes(e.target.checked)}
 />
 Round total up to whole {entityConfig.currency.code} ({entityConfig.payroll.taxAuthority}{' '}
 friendly)
 </label>
 {editRoundingPreview ? (
 editRoundToWholeKes ? (
 <>
 <p className="text-xs text-neutral-700 tabular-nums">
 Rounding adjustment (ex-VAT):{' '}
 {displayMoney(editRoundingPreview.adjExVat, data.currency)}
 </p>
 <p className="text-xs font-semibold text-primary-900 tabular-nums">
 Rounded total: {displayMoney(editRoundingPreview.achievedTotal, data.currency)}
 </p>
 {!editRoundingPreview.hitsTarget ? (
 <p className="text-xs text-amber-700">
 Exact {displayMoney(editRoundingPreview.targetTotal, data.currency)} is not attainable at
 this VAT rate with 2dp amounts; using the closest
 possible value above it.
 </p>
 ) : null}
 </>
 ) : (
 <p className="text-xs text-neutral-600">Enable to auto-add rounding adjustment line.</p>
 )
 ) : (
 <p className="text-xs text-neutral-500">
 No rounding option available for the current lines/VAT combination.
 </p>
 )}
 {editManualTotalOverride != null ? (
 <p className="text-xs font-semibold text-primary-900 tabular-nums">
 Override total: {displayMoney(editManualTotalOverride, data.currency)}
 </p>
 ) : (
 <p className="text-xs text-neutral-600">
 Optional final total override can be entered above when exact rounding is required.
 </p>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => void saveInvoiceEdits()}
 disabled={savingEdit}
 className="px-3 py-1.5 rounded-md bg-primary-900 text-white text-xs font-medium disabled:opacity-60"
 >
 {savingEdit ? 'Saving…' : 'Save changes'}
 </button>
 <button
 type="button"
 onClick={() => {
 setIsEditing(false);
 setEditForm({
 issueDate: data.issueDate,
 dueDate: data.dueDate ?? '',
 taxDate: data.taxDate ?? '',
 vatRateBps: data.vatRateBps,
 notes: data.notes ?? '',
 totalOverrideIncVat:
 data.totalOverrideIncVat != null ? String(Number(data.totalOverrideIncVat)) : '',
 lines: data.lines.map((l) => ({
 item: l.item,
 description: l.description ?? '',
 amountExVat: String(Number(l.amountExVat)),
 })),
 });
 setEditRoundToWholeKes(false);
 }}
 className="px-3 py-1.5 rounded-md border border-neutral-300 text-xs font-medium"
 >
 Cancel
 </button>
 </div>
 </div>
 ) : (
 <p className="text-xs text-neutral-500">
 Edit dates, VAT, notes, and line items for this invoice.
 </p>
 )}
 </div>
 ) : null}
 <div className="dashboard-surface px-4 py-3 text-sm space-y-2 print:hidden">
 <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Credit notes</p>
 {(data.creditTotalApplied ?? 0) > 0 && (
 <p className="text-neutral-700">
 Credited (incl. VAT):{' '}
 <span className="font-semibold tabular-nums">
 {displayMoney(data.creditTotalApplied ?? 0, data.currency)}
 </span>
 {data.remainingCreditable != null && (
 <>
 {' '}
 · Remaining creditable:{' '}
 <span className="font-semibold tabular-nums text-primary-900">
 {displayMoney(Math.max(0, data.remainingCreditable), data.currency)}
 </span>
 </>
 )}
 </p>
 )}
 {data.creditNotes && data.creditNotes.length > 0 ? (
 <ul className="space-y-1.5">
 {data.creditNotes.map((cn) => (
 <li key={cn.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-neutral-800">
 <span>
 CN #{cn.creditNoteNumber} · {cn.issueDate} · {displayMoney(cn.totalIncVat, data.currency)}
 </span>
 <a
 href={`/api/accounts/credit-notes/${cn.id}/pdf?disposition=inline`}
 target="_blank"
 rel="noopener noreferrer"
 className="text-primary-800 font-medium text-xs hover:underline"
 >
 Preview PDF
 </a>
 <a
 href={`/api/accounts/credit-notes/${cn.id}/pdf`}
 download
 className="text-primary-800 font-medium text-xs hover:underline"
 >
 Download
 </a>
 </li>
 ))}
 </ul>
 ) : (
 <p className="text-xs text-neutral-500">No credit notes yet.</p>
 )}
 {data.canIssueCreditNote ? (
 <Link
 href={`/dashboard/accounts/invoices/${id}/credit-note`}
 className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-lg border border-primary-200 bg-primary-50/80 text-primary-900 text-sm font-semibold hover:bg-primary-100/80 transition-colors"
 >
 <FileMinus2 className="w-4 h-4" />
 Issue credit note
 </Link>
 ) : (data.remainingCreditable ?? 0) <= 0.005 && (data.creditTotalApplied ?? 0) > 0 ? (
 <p className="text-xs text-neutral-500">This invoice is fully credited.</p>
 ) : (data.remainingCreditable ?? 0) > 0.005 ? (
 <p className="text-xs text-neutral-500">You don’t have permission to issue credit notes.</p>
 ) : (
 <p className="text-xs text-neutral-500">No amount remains to credit on this invoice.</p>
 )}
 </div>
 </div>

 {/* Print: full width between @page margins (0.5in L/R in globals.css); screen: full layout width */}
 <div className="w-full print:max-w-none print:w-full print:mx-0">
 <div className="dashboard-surface shadow-sm overflow-hidden print:shadow-none print:border print:border-neutral-300 print:rounded-none print:[print-color-adjust:exact]">
 <div className="px-6 sm:px-8 pt-6 sm:pt-8 print:px-7 print:pt-5">
 <div
 className="h-[3px] w-full bg-primary-900 mb-6 print:mb-5 rounded-sm print:h-[3px] print:min-h-[3px] print:bg-[#043d4a]"
 aria-hidden
 />
 <div className="flex items-center mb-8 print:mb-7">
 <BrandLogo
 variant="header"
 className="h-11 w-auto max-w-[10rem] sm:max-w-[11rem] object-contain object-left"
 priority
 />
 </div>
 </div>

 <div className="px-6 sm:px-8 pb-8 sm:pb-10 print:px-7 print:pb-6 space-y-8 sm:space-y-10 print:space-y-8">
 <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-8 lg:gap-12">
 <div className="min-w-0 lg:max-w-[55%]">
 <h1 className="text-xl sm:text-2xl font-bold text-primary-900 tracking-tight print:text-[18pt]">
 INVOICE
 </h1>
 <div className="mt-8 sm:mt-10 print:mt-8">
 <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">Invoice to</p>
 <p className="text-base sm:text-lg font-semibold text-primary-900 leading-snug">{data.clientName}</p>
 </div>
 </div>
 <div className="w-full lg:w-auto lg:min-w-[240px] shrink-0">
 <dl className="space-y-3 text-sm print:text-[10px]">
 <div className="flex justify-between gap-6 border-b border-transparent">
 <dt className="text-neutral-500">Invoice no.</dt>
 <dd className="font-semibold text-primary-900 tabular-nums text-right">{data.invoiceNumber}</dd>
 </div>
 <div className="flex justify-between gap-6">
 <dt className="text-neutral-500">Issue date</dt>
 <dd className="text-neutral-800 tabular-nums text-right">{data.issueDate}</dd>
 </div>
 <div className="flex justify-between gap-6">
 <dt className="text-neutral-500">Due date</dt>
 <dd className="text-neutral-800 tabular-nums text-right">{data.dueDate ?? '—'}</dd>
 </div>
 </dl>
 </div>
 </div>

 {data.notes?.trim() ? (
 <div className="space-y-2">
 <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Notes</p>
 <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{data.notes.trim()}</p>
 </div>
 ) : null}

 <section>
 <h2 className="text-sm font-bold text-primary-900 mb-4 sm:mb-5 print:text-xs print:mb-4">Line items</h2>
 <div className="border border-neutral-200 rounded-lg overflow-hidden print:border-neutral-300 print:rounded-sm">
 <table className="w-full text-sm print:text-[9px] table-fixed">
 <thead>
 <tr className="bg-neutral-100 border-b border-neutral-200 text-neutral-600 print:bg-neutral-200 print:border-neutral-300">
 <th className="py-3 px-3 font-semibold w-11 text-left">#</th>
 <th className="py-3 px-3 font-semibold text-left">Description</th>
 <th className="py-3 px-3 font-semibold text-right whitespace-nowrap w-[30%]">
 Amount ({data.currency})
 </th>
 </tr>
 </thead>
 <tbody>
 {data.lines.map((l) => (
 <tr key={l.id} className="border-b border-neutral-100 last:border-b-0 print:border-neutral-200">
 <td className="py-4 px-3 align-middle text-neutral-600 tabular-nums text-left">{l.lineNo}</td>
 <td className="py-4 px-3 align-middle text-left">
 <span className="font-semibold text-neutral-900 block">{l.item}</span>
 {l.description?.trim() ? (
 <span className="block text-neutral-600 text-xs sm:text-sm mt-1.5 leading-snug">
 {l.description.trim()}
 </span>
 ) : null}
 </td>
 <td className="py-4 px-3 align-middle text-right tabular-nums text-neutral-800 font-medium">
 {displayMoney(Number(l.amountExVat), data.currency)}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </section>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16 items-start print:gap-8">
 <div className="order-2 lg:order-1 print:order-1">
 {paymentDetails ? <InvoiceBankDisplay details={paymentDetails} /> : null}
 </div>
 <div className="order-1 lg:order-2 print:order-2 lg:justify-self-end w-full lg:max-w-sm">
 <div className="border border-neutral-200 rounded-lg p-5 sm:p-6 print:border-neutral-300 print:p-4 bg-white">
 <h2 className="text-sm font-bold text-primary-900 mb-4 print:text-xs print:mb-3">Summary</h2>
 <table className="w-full text-sm print:text-[9px]">
 <tbody>
 <tr>
 <td className="py-2 pr-4 text-left text-neutral-700">Subtotal (ex-VAT)</td>
 <td className="py-2 text-right tabular-nums font-medium text-neutral-900">
 {displayMoney(data.subtotalExVat, data.currency)}
 </td>
 </tr>
 <tr>
 <td className="py-2 pr-4 text-left text-neutral-700">{entityConfig.tax.vatLabel}</td>
 <td className="py-2 text-right tabular-nums text-neutral-800">
 {displayMoney(data.vatAmount, data.currency)}
 </td>
 </tr>
 <tr className="border-t border-neutral-200 print:border-neutral-300">
 <td className="py-3 pr-4 text-left font-semibold text-primary-900">Total (incl. VAT)</td>
 <td className="py-3 text-right tabular-nums font-bold text-primary-900 text-base print:text-[10px]">
 {displayMoney(data.totalIncVat, data.currency)}
 </td>
 </tr>
 </tbody>
 </table>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </DashboardPage>
 );
}
