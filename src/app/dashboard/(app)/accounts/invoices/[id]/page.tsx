'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
 Pencil,
} from 'lucide-react';
import {
 InvoicePaymentAccountSelect,
} from '@/components/accounts/InvoiceBankPanel';
import { InvoicePdfEmbed } from '@/components/accounts/InvoicePdfEmbed';
import type { PaymentAccountRow } from '@/lib/payment-accounts';
import useEntityConfig, { useDisplayMoney } from '@/hooks/useEntityConfig';
import { EntityContextBanner } from '@/components/EntityContextBanner';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  emptyInvoiceLineDraft,
  invoiceLineDraftsToAmounts,
  invoiceLineDraftsToPayload,
  lineTotalExVat,
  parseInvoiceLineQuantity,
  type InvoiceLineDraft,
} from '@/lib/accounts-invoice-line-draft';

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
 lines: InvoiceLineDraft[];
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
 quantity: '',
 })),
 });
 }, [data]);

 const editRoundingPreview = useMemo(() => {
 if (!editForm) return null;
 const previewLines = invoiceLineDraftsToAmounts(editForm.lines);
 const subtotal = previewLines.reduce((sum, l) => sum + l.amountExVat, 0);
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
 const validLines = invoiceLineDraftsToPayload(editForm.lines);
 if (validLines.length < 1) {
 setError('Add at least one line with a description and positive amount (ex-VAT).');
 return;
 }
 setSavingEdit(true);
 try {
 const payload: {
 issueDate: string;
 dueDate: string | null;
 taxDate: string | null;
 vatRateBps: number;
 notes: string;
 totalOverrideIncVat: number | null;
 lines: { item: string; description: string | null; amountExVat: number }[];
 } = {
 issueDate: editForm.issueDate,
 dueDate: editForm.dueDate || null,
 taxDate: editForm.taxDate || null,
 vatRateBps: editForm.vatRateBps,
 notes: editForm.notes,
 totalOverrideIncVat: editManualTotalOverride,
 lines: validLines.map((l) => ({
 item: l.item,
 description: l.description ?? null,
 amountExVat: l.amountExVat,
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
 <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-600 border-b border-neutral-200 pb-4">
 <span>
 <span className="text-neutral-500">Issue </span>
 <span className="font-medium text-neutral-900 tabular-nums">{data.issueDate}</span>
 </span>
 <span>
 <span className="text-neutral-500">Due </span>
 <span className="font-medium text-neutral-900 tabular-nums">{data.dueDate ?? '—'}</span>
 </span>
 <span>
 <span className="text-neutral-500">Total </span>
 <span className="font-semibold text-primary-900 tabular-nums">
 {displayMoney(data.totalIncVat, data.currency)}
 </span>
 </span>
 <span>
 <span className="text-neutral-500">Status </span>
 <span className="font-medium text-neutral-900 capitalize">{data.status}</span>
 </span>
 </div>
 <div className="flex flex-wrap gap-2">
 {data.canEditInvoice && editForm && !isEditing ? (
 <button
 type="button"
 onClick={() => setIsEditing(true)}
 className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-900 text-white text-sm font-medium hover:bg-primary-800 transition-colors"
 >
 <Pencil className="w-4 h-4" />
 Edit
 </button>
 ) : null}
 <a
 href={`/api/accounts/invoices/${id}/pdf?disposition=inline`}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 bg-white text-sm font-medium text-neutral-800 hover:bg-neutral-50 transition-colors"
 >
 <Eye className="w-4 h-4" />
 Open PDF
 </a>
 <a
 href={`/api/accounts/invoices/${id}/pdf`}
 download
 className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 bg-white text-sm font-medium text-neutral-800 hover:bg-neutral-50 transition-colors"
 >
 <Download className="w-4 h-4" />
 Download
 </a>
 <a
 href={`/api/accounts/invoices/${id}/pdf?disposition=inline`}
 target="_blank"
 rel="noopener noreferrer"
 onClick={(e) => {
 e.preventDefault();
 const w = window.open(`/api/accounts/invoices/${id}/pdf?disposition=inline`, '_blank');
 w?.addEventListener('load', () => w.print());
 }}
 className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 bg-white text-sm font-medium text-neutral-800 hover:bg-neutral-50 transition-colors"
 >
 <Printer className="w-4 h-4" />
 Print
 </a>
 </div>
 </div>

 <div className="grid lg:grid-cols-6 gap-6 items-start">
 <aside className="lg:col-span-4 space-y-4 print:hidden min-w-0">
 <div
 className="dashboard-surface px-4 py-3 shadow-sm"
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
 {isEditing ? (
 <span className="text-xs text-neutral-500">Editing</span>
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
 <div key={idx} className="grid grid-cols-12 gap-2 items-start">
 <input
 className="col-span-3 rounded-md border border-neutral-300 px-2 py-1.5"
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
 className="col-span-3 rounded-md border border-neutral-300 px-2 py-1.5"
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
 step="1"
 className="col-span-1 rounded-md border border-neutral-300 px-2 py-1.5"
 placeholder="Qty (opt.)"
 title="Quantity (optional)"
 value={line.quantity}
 onChange={(e) =>
 setEditForm((f) =>
 f
 ? {
 ...f,
 lines: f.lines.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)),
 }
 : f
 )
 }
 />
 <div className="col-span-3">
 <input
 type="number"
 min={0.01}
 step={0.01}
 className="w-full rounded-md border border-neutral-300 px-2 py-1.5"
 placeholder="Amount ex-VAT"
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
 {line.quantity.trim() !== '' &&
 lineTotalExVat(line.amountExVat, line.quantity) != null &&
 parseInvoiceLineQuantity(line.quantity) !== 1 ? (
 <p className="mt-0.5 text-[10px] text-neutral-500 tabular-nums">
 Line: {lineTotalExVat(line.amountExVat, line.quantity)!.toLocaleString('en-KE', {
 minimumFractionDigits: 2,
 maximumFractionDigits: 2,
 })}
 </p>
 ) : null}
 </div>
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
 lines: [...f.lines, emptyInvoiceLineDraft()],
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
 quantity: '',
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
 </aside>

 <InvoicePdfEmbed
 pdfUrl={`/api/accounts/invoices/${id}/pdf?disposition=inline`}
 title={`Invoice #${data.invoiceNumber} PDF`}
 className="lg:col-span-2 min-h-[min(80vh,720px)]"
 />
 </div>
 </DashboardPage>
 );
}
