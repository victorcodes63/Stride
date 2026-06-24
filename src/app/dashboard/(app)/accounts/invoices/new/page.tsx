'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { computeInvoiceVatFromLines } from '@/lib/accounts-invoice-totals';
import { InvoicePaymentAccountSelect } from '@/components/accounts/InvoiceBankPanel';
import type { PaymentAccountRow } from '@/lib/payment-accounts';
import useEntityConfig, { useDisplayMoney } from '@/hooks/useEntityConfig';
import { getEntityConfig } from '@/lib/entityConfig';
import { EntityContextBanner } from '@/components/EntityContextBanner';

type ClientRow = {
 id: string;
 name: string;
 currency: string;
 nextInvoiceNumber: number;
 type: string;
};

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

function computeInvoiceTotalFromSubtotal(
 subtotalExVat: number,
 vatRateBps: number,
): number {
 return computeInvoiceVatFromLines([{ amountExVat: subtotalExVat }], vatRateBps).totalIncVat;
}

/**
 * Find positive ex-VAT adjustment (2dp) that makes total incl. VAT hit targetTotal exactly.
 * Returns null when no 2dp adjustment in search window can produce exact total.
 */
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

function NewInvoiceForm() {
 const entityConfig = useEntityConfig();
 const displayMoney = useDisplayMoney();
 const router = useRouter();
 const searchParams = useSearchParams();
 const presetClientId = searchParams.get('clientId')?.trim() ?? '';

 const [clients, setClients] = useState<ClientRow[] | null>(null);
 const [loadError, setLoadError] = useState<string | null>(null);

 const [clientId, setClientId] = useState(presetClientId);
 const [issueDate, setIssueDate] = useState(todayIsoLocal);
 const [dueDate, setDueDate] = useState(() => addDaysIsoLocal(todayIsoLocal(), 30));
 const [taxDate, setTaxDate] = useState('');
 const [vatRateBps, setVatRateBps] = useState(1600);
 const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountRow[]>([]);
 const [paymentAccountsLoading, setPaymentAccountsLoading] = useState(true);
 const [paymentAccountId, setPaymentAccountId] = useState('');
 const [notes, setNotes] = useState('');
 const [roundTotalToWholeKes, setRoundTotalToWholeKes] = useState(false);
 const [manualTotalIncVat, setManualTotalIncVat] = useState('');

 const [lines, setLines] = useState<LineDraft[]>([
 { item: '', amountExVat: '', description: '' },
 ]);

 const [submitting, setSubmitting] = useState(false);
 const [formError, setFormError] = useState<string | null>(null);

 const loadClients = useCallback(() => {
 setLoadError(null);
 fetch('/api/accounts/clients')
 .then(async (r) => {
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || `Failed (${r.status})`);
 return data as { clients?: ClientRow[] };
 })
 .then((data) => {
 const list = Array.isArray(data.clients) ? data.clients : [];
 setClients(list);
 if (presetClientId && list.some((c) => c.id === presetClientId)) {
 setClientId(presetClientId);
 }
 })
 .catch((e) => {
 setLoadError(e instanceof Error ? e.message : 'Failed to load clients');
 setClients([]);
 });
 }, [presetClientId]);

 useEffect(() => {
 loadClients();
 }, [loadClients]);

 useEffect(() => {
 setPaymentAccountsLoading(true);
 fetch('/api/accounts/payment-accounts?activeOnly=1')
 .then(async (r) => {
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || `Failed (${r.status})`);
 return data as { accounts?: PaymentAccountRow[] };
 })
 .then((data) => {
 const accounts = Array.isArray(data.accounts) ? data.accounts : [];
 setPaymentAccounts(accounts);
 const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0];
 if (defaultAccount) setPaymentAccountId(defaultAccount.id);
 })
 .catch(() => setPaymentAccounts([]))
 .finally(() => setPaymentAccountsLoading(false));
 }, []);

 const selectedClient = useMemo(
 () => (clients ?? []).find((c) => c.id === clientId) ?? null,
 [clients, clientId],
 );

 const clientsGrouped = useMemo(() => {
 const list = [...(clients ?? [])];
 list.sort((a, b) => a.name.localeCompare(b.name));
 return list;
 }, [clients]);

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

 const roundingPreview = useMemo(() => {
 if (!totalsPreview) return null;
 const hasFraction = Math.abs(totalsPreview.totalIncVat - Math.round(totalsPreview.totalIncVat)) > 0.00001;
 if (!hasFraction) return null;
 const targetTotal = Math.ceil(totalsPreview.totalIncVat);
 const rounding = findRoundingAdjustmentExVat(
 totalsPreview.subtotalExVat,
 vatRateBps,
 targetTotal,
 );
 if (!rounding) return null;
 return { targetTotal, ...rounding };
 }, [totalsPreview, vatRateBps]);

 const manualTotalOverride = useMemo(() => {
 const n = parseFloat(manualTotalIncVat);
 if (!Number.isFinite(n) || n <= 0) return null;
 return Math.round(n * 100) / 100;
 }, [manualTotalIncVat]);

 const addLine = () => {
 setLines((prev) => [...prev, { item: '', amountExVat: '', description: '' }]);
 };

 const removeLine = (index: number) => {
 setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
 };

 const updateLine = (index: number, patch: Partial<LineDraft>) => {
 setLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
 };

 const syncDueToIssue = () => {
 setDueDate(addDaysIsoLocal(issueDate, 30));
 };

 const submit = async (e: React.FormEvent) => {
 e.preventDefault();
 setFormError(null);
 if (!clientId.trim()) {
 setFormError('Select a billing client.');
 return;
 }
 const payloadLines = lines
 .map((l) => ({
 item: l.item.trim(),
 amountExVat: parseFloat(l.amountExVat),
 description: l.description.trim() || undefined,
 }))
 .filter((l) => l.item.length > 0 || Number.isFinite(l.amountExVat));

 const validLines = payloadLines.filter(
 (l) => l.item.length > 0 && Number.isFinite(l.amountExVat) && l.amountExVat > 0,
 );
 if (validLines.length < 1) {
 setFormError('Add at least one line with a description and a positive amount (ex-VAT).');
 return;
 }

 setSubmitting(true);
 try {
 const body: Record<string, unknown> = {
 clientId: clientId.trim(),
 issueDate,
 dueDate: dueDate.trim() || null,
 taxDate: taxDate.trim() || undefined,
 vatRateBps,
 paymentAccountId,
 notes: notes.trim() || null,
 lines: validLines.map((l) => ({
 item: l.item,
 amountExVat: l.amountExVat,
 ...(l.description ? { description: l.description } : {}),
 })),
 };
 if (roundTotalToWholeKes && roundingPreview) {
 (body.lines as Array<Record<string, unknown>>).push({
 item: 'Rounding adjustment',
 amountExVat: roundingPreview.adjExVat,
 description: `Auto-added to round invoice total (incl. VAT) to whole ${entityConfig.currency.code} for ${entityConfig.payroll.taxAuthority} filing alignment.`,
 });
 }
 if (manualTotalOverride != null) {
 body.totalOverrideIncVat = manualTotalOverride;
 }
 const r = await fetch('/api/accounts/invoices', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 });
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
 const id = typeof j.id === 'string' ? j.id : null;
 if (id) router.push(`/dashboard/accounts/invoices/${id}`);
 else router.push('/dashboard/accounts/invoices');
 } catch (err) {
 setFormError(err instanceof Error ? err.message : 'Could not create invoice');
 } finally {
 setSubmitting(false);
 }
 };

 if (clients === null && !loadError) {
 return (
 <div className="flex items-center gap-2 text-neutral-600 py-12">
 <Loader2 className="w-5 h-5 animate-spin" />
 Loading…
 </div>
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
 <Link href="/dashboard/accounts/invoices" className="hover:text-primary-700 transition-colors">
 Invoices
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li className="text-primary-900 font-medium">New</li>
 </ol>
 </nav>

 <DashboardPageHeader
 title="New invoice"
 description={
 <>
 <EntityContextBanner />
 Pick any billing client (including custom / off-system profiles). Invoice numbers are global and
 sequential across all clients. {entityConfig.tax.whtLabel}: {entityConfig.tax.whtRates}.
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
 Client &amp; dates
 </p>
 <div className="grid sm:grid-cols-2 gap-4">
 <div className="sm:col-span-2">
 <label htmlFor="client" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Billing client *
 </label>
 <select
 id="client"
 required
 className={inputClass}
 value={clientId}
 onChange={(e) => setClientId(e.target.value)}
 >
 <option value="">Select…</option>
 {clientsGrouped.map((c) => (
 <option key={c.id} value={c.id}>
 {c.name} · {c.currency}
 </option>
 ))}
 </select>
 <p className="text-xs text-neutral-500 mt-1.5">
 Missing a client?{' '}
 <Link
 href="/dashboard/accounts/clients/new"
 className="text-primary-800 font-medium hover:underline"
 >
 Add billing client
 </Link>
 </p>
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
 <button
 type="button"
 className="mt-1.5 text-xs text-primary-700 hover:underline"
 onClick={syncDueToIssue}
 >
 Reset due date to issue + 30 days
 </button>
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
 <div>
 <label htmlFor="tax" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Tax date
 </label>
 <input
 id="tax"
 type="date"
 className={inputClass}
 value={taxDate}
 onChange={(e) => setTaxDate(e.target.value)}
 />
 <p className="text-xs text-neutral-500 mt-1">Leave empty to use issue date.</p>
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
 </div>
 <InvoicePaymentAccountSelect
 accounts={paymentAccounts}
 value={paymentAccountId}
 onChange={setPaymentAccountId}
 disabled={submitting}
 loading={paymentAccountsLoading}
 compact
 />
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
 placeholder="e.g. Monthly HR retainer"
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
 <label className="block text-xs font-medium text-neutral-600 mb-1">Notes (optional)</label>
 <input
 className={inputClass}
 value={line.description}
 onChange={(e) => updateLine(index, { description: e.target.value })}
 placeholder="Internal"
 />
 </div>
 <div className="md:col-span-1 flex items-end justify-end">
 <button
 type="button"
 onClick={() => removeLine(index)}
 disabled={lines.length <= 1}
 className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent"
 aria-label="Remove line"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 ))}
 </div>

 {totalsPreview && selectedClient && (
 <div className="rounded-xl border border-primary-100 bg-primary-50/50 px-4 py-3 text-sm space-y-1">
 <p className="font-semibold text-primary-900">Preview</p>
 <p className="text-neutral-700 tabular-nums">
 Subtotal ex-VAT: {displayMoney(totalsPreview.subtotalExVat, selectedClient.currency)}
 </p>
 <p className="text-neutral-700 tabular-nums">
 {entityConfig.tax.vatLabel} ({vatRateBps / 100}%):{' '}
 {displayMoney(totalsPreview.vatAmount, selectedClient.currency)}
 </p>
 <p className="font-bold text-primary-900 tabular-nums">
 Total: {displayMoney(totalsPreview.totalIncVat, selectedClient.currency)}
 </p>
 <div className="mt-2 pt-2 border-t border-primary-100 space-y-1">
 <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
 <input
 type="checkbox"
 checked={roundTotalToWholeKes}
 disabled={!roundingPreview}
 onChange={(e) => setRoundTotalToWholeKes(e.target.checked)}
 />
 Round total up to whole {entityConfig.currency.code} ({entityConfig.payroll.taxAuthority} friendly)
 </label>
 {roundingPreview ? (
 roundTotalToWholeKes ? (
 <>
 <p className="text-xs text-neutral-700 tabular-nums">
 Rounding adjustment (ex-VAT): {displayMoney(roundingPreview.adjExVat, selectedClient.currency)}
 </p>
 <p className="text-xs font-semibold text-primary-900 tabular-nums">
 Rounded total: {displayMoney(roundingPreview.achievedTotal, selectedClient.currency)}
 </p>
 {!roundingPreview.hitsTarget ? (
 <p className="text-xs text-amber-700">
 Exact {displayMoney(roundingPreview.targetTotal, selectedClient.currency)} is not attainable at
 this VAT rate with 2dp amounts; using the
 closest possible value above it.
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
 </div>
 <div className="mt-2 pt-2 border-t border-primary-100 space-y-1">
 <label className="block text-xs text-neutral-700">
 Final total override (incl. VAT)
 <input
 type="number"
 min={0}
 step={0.01}
 value={manualTotalIncVat}
 onChange={(e) => setManualTotalIncVat(e.target.value)}
 placeholder="e.g. 450000.00"
 className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
 />
 </label>
 <p className="text-xs text-neutral-600">
 Optional. Sets the invoice final total exactly as entered for display/PDF/export.
 </p>
 {manualTotalOverride != null ? (
 <p className="text-xs font-semibold text-primary-900 tabular-nums">
 Override total: {displayMoney(manualTotalOverride, selectedClient.currency)}
 </p>
 ) : null}
 </div>
 </div>
 )}
 </div>

 <div className="dashboard-surface p-5 sm:p-6 shadow-sm">
 <label htmlFor="notes" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Invoice notes (optional)
 </label>
 <textarea
 id="notes"
 rows={3}
 className={inputClass}
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 placeholder="Shown on PDF / detail view"
 />
 </div>

 <div className="flex flex-wrap gap-3">
 <button
 type="submit"
 disabled={submitting || !clients?.length}
 className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-60"
 >
 {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
 Create invoice
 </button>
 <Link
 href="/dashboard/accounts/invoices"
 className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
 >
 Cancel
 </Link>
 </div>
 </form>
 </DashboardPage>
 );
}

export default function NewInvoicePage() {
 return (
 <Suspense
 fallback={
 <div className="flex items-center gap-2 text-neutral-600 py-12">
 <Loader2 className="w-5 h-5 animate-spin" />
 Loading…
 </div>
 }
 >
 <NewInvoiceForm />
 </Suspense>
 );
}
