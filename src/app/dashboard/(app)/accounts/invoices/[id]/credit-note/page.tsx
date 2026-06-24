'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { computeInvoiceVatFromLines } from '@/lib/accounts-invoice-totals';
import { InvoicePaymentAccountSelect } from '@/components/accounts/InvoiceBankPanel';
import type { PaymentAccountRow } from '@/lib/payment-accounts';
import useEntityConfig, { useDisplayMoney } from '@/hooks/useEntityConfig';
import { EntityContextBanner } from '@/components/EntityContextBanner';

type LineDraft = { item: string; amountExVat: string; description: string };

const inputClass =
 'w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30';

function todayIso(): string {
 const n = new Date();
 return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export default function NewCreditNotePage() {
 const entityConfig = useEntityConfig();
 const displayMoney = useDisplayMoney();
 const params = useParams();
 const router = useRouter();
 const invoiceId = typeof params.id === 'string' ? params.id : '';

 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [inv, setInv] = useState<{
 invoiceNumber: number;
 clientName: string;
 currency: string;
 vatRateBps: number;
 remainingCreditable: number;
 canIssueCreditNote: boolean;
 } | null>(null);

 const [issueDate, setIssueDate] = useState(todayIso);
 const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountRow[]>([]);
 const [paymentAccountsLoading, setPaymentAccountsLoading] = useState(true);
 const [paymentAccountId, setPaymentAccountId] = useState('');
 const [notes, setNotes] = useState('');
 const [lines, setLines] = useState<LineDraft[]>([{ item: '', amountExVat: '', description: '' }]);
 const [submitting, setSubmitting] = useState(false);
 const [formError, setFormError] = useState<string | null>(null);

 const load = useCallback(() => {
 if (!invoiceId) return Promise.resolve();
 return fetch(`/api/accounts/invoices/${invoiceId}`)
 .then(async (r) => {
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
 return j as {
 invoiceNumber: number;
 clientName: string;
 currency: string;
 vatRateBps: number;
 remainingCreditable: number;
 canIssueCreditNote: boolean;
 paymentAccountId: string | null;
 paymentBank: string;
 };
 })
 .then((data) => {
 setInv({
 invoiceNumber: data.invoiceNumber,
 clientName: data.clientName,
 currency: data.currency,
 vatRateBps: data.vatRateBps,
 remainingCreditable: data.remainingCreditable,
 canIssueCreditNote: data.canIssueCreditNote,
 });
 if (data.paymentAccountId) setPaymentAccountId(data.paymentAccountId);
 setError(null);
 })
 .catch((e) => {
 setError(e instanceof Error ? e.message : 'Failed to load');
 setInv(null);
 });
 }, [invoiceId]);

 useEffect(() => {
 if (!invoiceId) {
 setLoading(false);
 setError('Invalid invoice');
 return;
 }
 let c = false;
 setLoading(true);
 load().finally(() => {
 if (!c) setLoading(false);
 });
 return () => {
 c = true;
 };
 }, [invoiceId, load]);

 useEffect(() => {
 setPaymentAccountsLoading(true);
 fetch('/api/accounts/payment-accounts?activeOnly=1')
 .then(async (r) => {
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
 return j as { accounts?: PaymentAccountRow[] };
 })
 .then((payload) => {
 const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
 setPaymentAccounts(accounts);
 setPaymentAccountId((current) => current || accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || '');
 })
 .catch(() => setPaymentAccounts([]))
 .finally(() => setPaymentAccountsLoading(false));
 }, []);

 const previewLines = lines
 .map((l) => {
 const n = parseFloat(l.amountExVat);
 if (!Number.isFinite(n) || n <= 0) return null;
 return { amountExVat: n };
 })
 .filter(Boolean) as { amountExVat: number }[];

 const totals =
 inv && previewLines.length > 0
 ? computeInvoiceVatFromLines(previewLines, inv.vatRateBps)
 : null;

 const submit = async (e: React.FormEvent) => {
 e.preventDefault();
 setFormError(null);
 if (!invoiceId || !inv?.canIssueCreditNote) return;

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

 const t = computeInvoiceVatFromLines(
 validLines.map((l) => ({ amountExVat: l.amountExVat })),
 inv.vatRateBps,
 );
 if (t.totalIncVat > inv.remainingCreditable + 0.02) {
 setFormError(
 `Credit total (incl. VAT) ${displayMoney(t.totalIncVat, inv.currency)} exceeds remaining creditable ${displayMoney(inv.remainingCreditable, inv.currency)} for this invoice.`,
 );
 return;
 }

 setSubmitting(true);
 try {
 const r = await fetch('/api/accounts/credit-notes', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 originalInvoiceId: invoiceId,
 issueDate,
 vatRateBps: inv.vatRateBps,
 paymentAccountId,
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
 const cnId = typeof j.id === 'string' ? j.id : null;
 if (cnId) router.push(`/dashboard/accounts/invoices/${invoiceId}`);
 else router.push(`/dashboard/accounts/invoices/${invoiceId}`);
 } catch (err) {
 setFormError(err instanceof Error ? err.message : 'Could not create credit note');
 } finally {
 setSubmitting(false);
 }
 };

 if (loading) {
 return (
 <div className="flex items-center gap-2 text-neutral-600 py-12">
 <Loader2 className="w-5 h-5 animate-spin" />
 Loading…
 </div>
 );
 }

 if (error || !inv) {
 return (
 <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 flex gap-2">
 <AlertCircle className="w-5 h-5 shrink-0" />
 {error || 'Not found'}
 </div>
 );
 }

 if (!inv.canIssueCreditNote) {
 return (
 <div className="max-w-xl space-y-4">
 <nav className="text-sm text-neutral-500">
 <Link href="/dashboard/accounts/invoices" className="hover:text-primary-700">
 Invoices
 </Link>
 <span className="mx-1">/</span>
 <Link href={`/dashboard/accounts/invoices/${invoiceId}`} className="hover:text-primary-700">
 #{inv.invoiceNumber}
 </Link>
 <span className="mx-1">/</span>
 <span className="text-primary-900 font-medium">Credit note</span>
 </nav>
 <p className="text-neutral-700 text-sm">
 Nothing left to credit on this invoice (or you don&apos;t have permission). Remaining creditable:{' '}
 {displayMoney(inv.remainingCreditable, inv.currency)}
 </p>
 <Link
 href={`/dashboard/accounts/invoices/${invoiceId}`}
 className="inline-flex text-sm font-medium text-primary-800 underline"
 >
 Back to invoice
 </Link>
 </div>
 );
 }

 return (
 <DashboardPage className="max-w-3xl">
 <nav className="mb-4 text-sm text-neutral-500">
 <Link href="/dashboard/accounts/invoices" className="hover:text-primary-700">
 Invoices
 </Link>
 <span className="mx-1">/</span>
 <Link href={`/dashboard/accounts/invoices/${invoiceId}`} className="hover:text-primary-700">
 #{inv.invoiceNumber}
 </Link>
 <span className="mx-1">/</span>
 <span className="text-primary-900 font-medium">New credit note</span>
 </nav>

 <DashboardPageHeader
 title="Credit note"
 description={
 <>
 <EntityContextBanner />
 Invoice #{inv.invoiceNumber} · {inv.clientName}. Remaining creditable:{' '}
 <strong>{displayMoney(inv.remainingCreditable, inv.currency)}</strong> (incl. VAT).{' '}
 {entityConfig.tax.whtLabel}: {entityConfig.tax.whtRates}.
 </>
 }
 className="mb-6"
 />

 <form onSubmit={submit} className="space-y-6 dashboard-surface p-5 sm:p-6 shadow-sm">
 {formError && (
 <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 flex gap-2">
 <AlertCircle className="w-5 h-5 shrink-0" />
 {formError}
 </div>
 )}

 <div className="grid sm:grid-cols-2 gap-4">
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
 <div className="sm:col-span-2">
 <InvoicePaymentAccountSelect
 accounts={paymentAccounts}
 value={paymentAccountId}
 onChange={setPaymentAccountId}
 disabled={submitting}
 loading={paymentAccountsLoading}
 />
 </div>
 <div className="sm:col-span-2">
 <label htmlFor="notes" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Reason / notes
 </label>
 <textarea
 id="notes"
 rows={3}
 className={inputClass}
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 placeholder="e.g. Client disputed line items; corrected billing per agreement dated …"
 />
 </div>
 </div>

 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Lines (ex-VAT)</p>
 <button
 type="button"
 onClick={() => setLines((p) => [...p, { item: '', amountExVat: '', description: '' }])}
 className="inline-flex items-center gap-1 text-sm font-medium text-primary-800"
 >
 <Plus className="w-4 h-4" />
 Add line
 </button>
 </div>
 {lines.map((line, index) => (
 <div
 key={index}
 className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 rounded-xl border border-neutral-100 bg-neutral-50/50"
 >
 <div className="md:col-span-6">
 <label className="block text-xs text-neutral-600 mb-1">Description *</label>
 <input
 className={inputClass}
 value={line.item}
 onChange={(e) =>
 setLines((p) => p.map((row, i) => (i === index ? { ...row, item: e.target.value } : row)))
 }
 />
 </div>
 <div className="md:col-span-3">
 <label className="block text-xs text-neutral-600 mb-1">Amount ex-VAT *</label>
 <input
 type="number"
 min={0.01}
 step={0.01}
 className={inputClass}
 value={line.amountExVat}
 onChange={(e) =>
 setLines((p) => p.map((row, i) => (i === index ? { ...row, amountExVat: e.target.value } : row)))
 }
 />
 </div>
 <div className="md:col-span-2">
 <label className="block text-xs text-neutral-600 mb-1">Notes</label>
 <input
 className={inputClass}
 value={line.description}
 onChange={(e) =>
 setLines((p) => p.map((row, i) => (i === index ? { ...row, description: e.target.value } : row)))
 }
 />
 </div>
 <div className="md:col-span-1 flex items-end">
 <button
 type="button"
 onClick={() => setLines((p) => (p.length <= 1 ? p : p.filter((_, i) => i !== index)))}
 className="p-2 text-neutral-500 hover:text-red-700"
 aria-label="Remove"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 ))}
 {totals && (
 <p className="text-sm text-neutral-700">
 Credit total (incl. VAT):{' '}
 <span className="font-semibold tabular-nums">{displayMoney(totals.totalIncVat, inv.currency)}</span>
 </p>
 )}
 </div>

 <div className="flex flex-wrap gap-2">
 <button
 type="submit"
 disabled={submitting}
 className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-60"
 >
 {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
 Issue credit note
 </button>
 <Link
 href={`/dashboard/accounts/invoices/${invoiceId}`}
 className="inline-flex items-center px-5 py-2.5 rounded-lg border border-neutral-300 text-sm font-medium"
 >
 Cancel
 </Link>
 </div>
 </form>
 </DashboardPage>
 );
}
