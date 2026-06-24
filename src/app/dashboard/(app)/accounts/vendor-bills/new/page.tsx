'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { computeInvoiceVatFromLines } from '@/lib/accounts-invoice-totals';
import useEntityConfig, { useDisplayMoney } from '@/hooks/useEntityConfig';
import { getEntityConfig } from '@/lib/entityConfig';
import { EntityContextBanner } from '@/components/EntityContextBanner';

type VendorRow = { id: string; name: string; currency: string };

function todayIsoLocal(): string {
 const n = new Date();
 const y = n.getFullYear();
 const m = String(n.getMonth() + 1).padStart(2, '0');
 const d = String(n.getDate()).padStart(2, '0');
 return `${y}-${m}-${d}`;
}

function addDaysIsoLocal(iso: string, days: number): string {
 const [y, mo, d] = iso.split('-').map((x) => parseInt(x, 10));
 const dt = new Date(y, mo - 1, d);
 dt.setDate(dt.getDate() + days);
 const yy = dt.getFullYear();
 const mm = String(dt.getMonth() + 1).padStart(2, '0');
 const dd = String(dt.getDate()).padStart(2, '0');
 return `${yy}-${mm}-${dd}`;
}

const inputClass =
 'w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30';

type LineDraft = { item: string; amountExVat: string; description: string };

function NewVendorBillForm() {
 const entityConfig = useEntityConfig();
 const displayMoney = useDisplayMoney();
 const router = useRouter();
 const searchParams = useSearchParams();
 const presetVendorId = searchParams.get('vendorId')?.trim() ?? '';

 const [vendors, setVendors] = useState<VendorRow[] | null>(null);
 const [loadError, setLoadError] = useState<string | null>(null);

 const [vendorId, setVendorId] = useState(presetVendorId);
 const [billRef, setBillRef] = useState('');
 const [issueDate, setIssueDate] = useState(todayIsoLocal);
 const [dueDate, setDueDate] = useState(() => addDaysIsoLocal(todayIsoLocal(), 30));
 const [vatRateBps, setVatRateBps] = useState(1600);
 const [notes, setNotes] = useState('');

 const [lines, setLines] = useState<LineDraft[]>([
 { item: '', amountExVat: '', description: '' },
 ]);

 const [submitting, setSubmitting] = useState(false);
 const [formError, setFormError] = useState<string | null>(null);

 const loadVendors = useCallback(() => {
 setLoadError(null);
 fetch('/api/accounts/vendors')
 .then(async (r) => {
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || `Failed (${r.status})`);
 return data as { vendors?: VendorRow[] };
 })
 .then((data) => {
 const list = Array.isArray(data.vendors) ? data.vendors : [];
 setVendors(list);
 if (presetVendorId && list.some((v) => v.id === presetVendorId)) {
 setVendorId(presetVendorId);
 }
 })
 .catch((e) => {
 setLoadError(e instanceof Error ? e.message : 'Failed to load vendors');
 setVendors([]);
 });
 }, [presetVendorId]);

 useEffect(() => {
 loadVendors();
 }, [loadVendors]);

 const previewLines = useMemo(() => {
 return lines
 .map((l) => {
 const n = parseFloat(l.amountExVat);
 if (!Number.isFinite(n) || n <= 0) return null;
 return { amountExVat: n };
 })
 .filter(Boolean) as { amountExVat: number }[];
 }, [lines]);

 const totalsPreview = useMemo(() => {
 if (previewLines.length === 0) return null;
 return computeInvoiceVatFromLines(previewLines, vatRateBps);
 }, [previewLines, vatRateBps]);

 const selectedVendor = useMemo(
 () => (vendors ?? []).find((v) => v.id === vendorId),
 [vendors, vendorId],
 );
 const previewCurrency = selectedVendor?.currency ?? entityConfig.currency.code;

 const addLine = () => {
 setLines((prev) => [...prev, { item: '', amountExVat: '', description: '' }]);
 };

 const removeLine = (index: number) => {
 setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
 };

 const updateLine = (index: number, patch: Partial<LineDraft>) => {
 setLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
 };

 const submit = async (e: React.FormEvent) => {
 e.preventDefault();
 setFormError(null);
 if (!vendorId.trim()) {
 setFormError('Select a vendor.');
 return;
 }
 const validLines = lines
 .map((l) => ({
 item: l.item.trim(),
 amountExVat: parseFloat(l.amountExVat),
 description: l.description.trim() || undefined,
 }))
 .filter((l) => l.item.length > 0 && Number.isFinite(l.amountExVat) && l.amountExVat > 0);

 if (validLines.length < 1) {
 setFormError('Add at least one line with description and positive ex-VAT amount.');
 return;
 }

 setSubmitting(true);
 try {
 const r = await fetch('/api/accounts/vendor-bills', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 vendorId: vendorId.trim(),
 billRef: billRef.trim() || null,
 issueDate,
 dueDate: dueDate.trim() || null,
 vatRateBps,
 notes: notes.trim() || null,
 lines: validLines.map((l) => ({
 item: l.item,
 amountExVat: l.amountExVat,
 ...(l.description ? { description: l.description } : {}),
 })),
 }),
 });
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
 const id = typeof j.id === 'string' ? j.id : null;
 if (id) router.push(`/dashboard/accounts/vendor-bills/${id}`);
 else router.push('/dashboard/accounts/vendor-bills');
 } catch (err) {
 setFormError(err instanceof Error ? err.message : 'Could not create bill');
 } finally {
 setSubmitting(false);
 }
 };

 if (vendors === null && !loadError) {
 return (
 <div className="flex items-center gap-2 text-neutral-600 py-12">
 <Loader2 className="w-5 h-5 animate-spin" />
 Loading…
 </div>
 );
 }

 return (
 <DashboardPage className="max-w-4xl">
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
 <li aria-hidden="true">/</li>
 <li className="text-primary-900 font-medium">New</li>
 </ol>
 </nav>

 <DashboardPageHeader
 title="New vendor bill"
 description={
 <>
 <EntityContextBanner />
 Enter supplier reference, dates, and ex-VAT lines. {entityConfig.tax.vatLabel} matches invoice logic (on
 subtotal). {entityConfig.tax.whtLabel}: {entityConfig.tax.whtRates}.
 </>
 }
 className="mb-6"
 />

 {loadError && (
 <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
 <AlertCircle className="w-5 h-5 shrink-0" />
 {loadError}
 </div>
 )}

 <form onSubmit={submit} className="space-y-8">
 {formError && (
 <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 flex gap-2">
 <AlertCircle className="w-5 h-5 shrink-0" />
 {formError}
 </div>
 )}

 <div className="dashboard-surface p-5 sm:p-6 shadow-sm space-y-4">
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500">
 Vendor &amp; dates
 </p>
 <div className="grid sm:grid-cols-2 gap-4">
 <div className="sm:col-span-2">
 <label htmlFor="vendor" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Vendor *
 </label>
 <select
 id="vendor"
 required
 className={inputClass}
 value={vendorId}
 onChange={(e) => setVendorId(e.target.value)}
 >
 <option value="">Select…</option>
 {(vendors ?? []).map((v) => (
 <option key={v.id} value={v.id}>
 {v.name} · {v.currency}
 </option>
 ))}
 </select>
 <p className="text-xs text-neutral-500 mt-1.5">
 <Link href="/dashboard/accounts/vendors/new" className="text-primary-800 font-medium hover:underline">
 Add vendor
 </Link>
 </p>
 </div>
 <div>
 <label htmlFor="billRef" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Supplier reference
 </label>
 <input
 id="billRef"
 className={inputClass}
 value={billRef}
 onChange={(e) => setBillRef(e.target.value)}
 placeholder="Invoice / PO number (optional)"
 />
 </div>
 <div>
 <label htmlFor="vat" className="block text-sm font-medium text-neutral-800 mb-1.5">
 {entityConfig.tax.vatLabel} rate
 </label>
 <select
 id="vat"
 className={inputClass}
 value={vatRateBps}
 onChange={(e) => setVatRateBps(parseInt(e.target.value, 10))}
 >
 <option value={1600}>{getEntityConfig('ke').tax.vatRate} (standard)</option>
 <option value={1800}>{getEntityConfig('ug').tax.vatRate} (standard)</option>
 <option value={0}>0% (zero-rated / exempt)</option>
 </select>
 </div>
 <div>
 <label htmlFor="issue" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Issue date *
 </label>
 <input
 id="issue"
 type="date"
 required
 className={inputClass}
 value={issueDate}
 onChange={(e) => setIssueDate(e.target.value)}
 />
 </div>
 <div>
 <label htmlFor="due" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Due date
 </label>
 <input
 id="due"
 type="date"
 className={inputClass}
 value={dueDate}
 onChange={(e) => setDueDate(e.target.value)}
 />
 </div>
 <div className="sm:col-span-2">
 <label htmlFor="notes" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Notes
 </label>
 <textarea
 id="notes"
 rows={2}
 className={inputClass}
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 />
 </div>
 </div>
 </div>

 <div className="dashboard-surface p-5 sm:p-6 shadow-sm space-y-4">
 <div className="flex items-center justify-between gap-2 flex-wrap">
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500">
 Line items (ex-VAT)
 </p>
 <button
 type="button"
 onClick={addLine}
 className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-800 hover:text-primary-600"
 >
 <Plus className="w-4 h-4" />
 Add line
 </button>
 </div>
 <div className="space-y-4">
 {lines.map((line, index) => (
 <div
 key={index}
 className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 rounded-xl border border-neutral-100 bg-neutral-50/50"
 >
 <div className="md:col-span-6">
 <label className="block text-xs font-medium text-neutral-600 mb-1">Description *</label>
 <input
 className={inputClass}
 value={line.item}
 onChange={(e) => updateLine(index, { item: e.target.value })}
 placeholder="e.g. Monthly internet"
 />
 </div>
 <div className="md:col-span-3">
 <label className="block text-xs font-medium text-neutral-600 mb-1">Amount ex-VAT *</label>
 <input
 className={inputClass}
 type="number"
 min={0.01}
 step="0.01"
 value={line.amountExVat}
 onChange={(e) => updateLine(index, { amountExVat: e.target.value })}
 placeholder="0.00"
 />
 </div>
 <div className="md:col-span-2">
 <label className="block text-xs font-medium text-neutral-600 mb-1">Notes</label>
 <input
 className={inputClass}
 value={line.description}
 onChange={(e) => updateLine(index, { description: e.target.value })}
 />
 </div>
 <div className="md:col-span-1 flex items-end">
 <button
 type="button"
 onClick={() => removeLine(index)}
 className="p-2 rounded-lg text-neutral-500 hover:bg-red-50 hover:text-red-700"
 aria-label="Remove line"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 ))}
 </div>
 {totalsPreview && (
 <div className="dashboard-surface rounded-lg px-4 py-3 text-sm space-y-1">
 <div className="flex justify-between text-neutral-700">
 <span>Subtotal ex-VAT</span>
 <span className="tabular-nums font-medium">
 {displayMoney(totalsPreview.subtotalExVat, previewCurrency)}
 </span>
 </div>
 <div className="flex justify-between text-neutral-700">
 <span>{entityConfig.tax.vatLabel}</span>
 <span className="tabular-nums">{displayMoney(totalsPreview.vatAmount, previewCurrency)}</span>
 </div>
 <div className="flex justify-between font-semibold text-primary-900 pt-1 border-t border-neutral-100">
 <span>Total incl. VAT</span>
 <span className="tabular-nums">{displayMoney(totalsPreview.totalIncVat, previewCurrency)}</span>
 </div>
 </div>
 )}
 </div>

 <div className="flex flex-wrap gap-2">
 <button
 type="submit"
 disabled={submitting}
 className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-60"
 >
 {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
 Create bill
 </button>
 <Link
 href="/dashboard/accounts/vendor-bills"
 className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
 >
 Cancel
 </Link>
 </div>
 </form>
 </DashboardPage>
 );
}

export default function NewVendorBillPage() {
 return (
 <Suspense
 fallback={
 <div className="flex items-center gap-2 text-neutral-600 py-12">
 <Loader2 className="w-5 h-5 animate-spin" />
 Loading…
 </div>
 }
 >
 <NewVendorBillForm />
 </Suspense>
 );
}
