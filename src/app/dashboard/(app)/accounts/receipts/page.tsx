'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
 Wallet,
 Loader2,
 AlertCircle,
 Plus,
 Trash2,
 Building2,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type ClientRow = { id: string; name: string; currency: string };

type OpenInvoice = {
 id: string;
 invoiceNumber: number;
 issueDate: string;
 currency: string;
 status: string;
 totalIncVat: number;
 allocatedTotal?: number;
 balanceDue?: number;
};

type AllocationDraft = { invoiceId: string; amount: string };

type PaymentRow = {
 id: string;
 clientId: string;
 clientName: string;
 clientCurrency: string;
 receivedAt: string;
 amount: number;
 reference: string | null;
 method: string | null;
 allocations: { id: string; invoiceId: string; invoiceNumber: number; amount: number }[];
};

function todayIso(): string {
 const n = new Date();
 return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function money(n: number, currency: string) {
 return `${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

const inputClass = 'dash-auth-input w-full min-w-0 rounded-lg px-3 py-2 text-sm';
const labelClass = 'block text-sm font-medium text-[var(--dash-text-strong)] mb-1.5';
const sectionLabelClass =
 'text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[var(--dash-text-muted)]';

function ReceiptsPageInner() {
 const searchParams = useSearchParams();
 const presetClientId = searchParams.get('clientId')?.trim() ?? '';

 const [clients, setClients] = useState<ClientRow[] | null>(null);
 const [openInvoices, setOpenInvoices] = useState<OpenInvoice[] | null>(null);
 const [payments, setPayments] = useState<PaymentRow[] | null>(null);
 const [canManagePayments, setCanManagePayments] = useState(false);
 const [listError, setListError] = useState<string | null>(null);
 const [invoicesError, setInvoicesError] = useState<string | null>(null);

 /** Table filter: empty = all clients */
 const [listFilterClientId, setListFilterClientId] = useState(presetClientId);
 /** New receipt form */
 const [receiptClientId, setReceiptClientId] = useState(presetClientId);
 const [receivedAt, setReceivedAt] = useState(todayIso);
 const [amount, setAmount] = useState('');
 const [reference, setReference] = useState('');
 const [method, setMethod] = useState('');
 const [notes, setNotes] = useState('');
 const [allocations, setAllocations] = useState<AllocationDraft[]>([{ invoiceId: '', amount: '' }]);
 const [submitting, setSubmitting] = useState(false);
 const [formError, setFormError] = useState<string | null>(null);

 const loadClients = useCallback(() => {
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
 setListFilterClientId(presetClientId);
 setReceiptClientId(presetClientId);
 }
 })
 .catch(() => setClients([]));
 }, [presetClientId]);

 const loadPayments = useCallback(() => {
 setListError(null);
 const q = listFilterClientId.trim()
 ? `?clientId=${encodeURIComponent(listFilterClientId.trim())}`
 : '';
 fetch(`/api/accounts/client-payments${q}`)
 .then(async (r) => {
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || `Failed (${r.status})`);
 return data as { payments?: PaymentRow[]; canManagePayments?: boolean };
 })
 .then((data) => {
 setPayments(Array.isArray(data.payments) ? data.payments : []);
 setCanManagePayments(data.canManagePayments === true);
 })
 .catch((e) => {
 setListError(e instanceof Error ? e.message : 'Failed to load receipts');
 setPayments([]);
 setCanManagePayments(false);
 });
 }, [listFilterClientId]);

 const loadOpenInvoices = useCallback((cid: string) => {
 if (!cid.trim()) {
 setOpenInvoices(null);
 return;
 }
 setInvoicesError(null);
 const q = `?clientId=${encodeURIComponent(cid.trim())}&openOnly=1&withBalance=1`;
 fetch(`/api/accounts/invoices${q}`)
 .then(async (r) => {
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || `Failed (${r.status})`);
 return data as { invoices?: OpenInvoice[] };
 })
 .then((data) => {
 setOpenInvoices(Array.isArray(data.invoices) ? data.invoices : []);
 })
 .catch((e) => {
 setInvoicesError(e instanceof Error ? e.message : 'Failed to load invoices');
 setOpenInvoices([]);
 });
 }, []);

 useEffect(() => {
 loadClients();
 }, [loadClients]);

 useEffect(() => {
 loadPayments();
 }, [loadPayments]);

 useEffect(() => {
 loadOpenInvoices(receiptClientId);
 setAllocations([{ invoiceId: '', amount: '' }]);
 }, [receiptClientId, loadOpenInvoices]);

 const selectedClient = useMemo(
 () => (clients ?? []).find((c) => c.id === receiptClientId) ?? null,
 [clients, receiptClientId],
 );

 const allocationTotal = useMemo(() => {
 return allocations.reduce((s, row) => {
 const n = parseFloat(String(row.amount).replace(/,/g, ''));
 return s + (Number.isFinite(n) ? n : 0);
 }, 0);
 }, [allocations]);

 const receiptAmountNum = useMemo(() => {
 const n = parseFloat(String(amount).replace(/,/g, ''));
 return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
 }, [amount]);

 const addAllocRow = () => {
 setAllocations((prev) => [...prev, { invoiceId: '', amount: '' }]);
 };

 const removeAllocRow = (index: number) => {
 setAllocations((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
 };

 const updateAlloc = (index: number, patch: Partial<AllocationDraft>) => {
 setAllocations((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
 };

 const fillBalance = (index: number) => {
 const row = allocations[index];
 if (!row?.invoiceId || !openInvoices) return;
 const inv = openInvoices.find((i) => i.id === row.invoiceId);
 if (!inv || inv.balanceDue == null) return;
 const due = Math.max(0, inv.balanceDue);
 updateAlloc(index, {
 amount: due.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
 });
 };

 const submit = async (e: React.FormEvent) => {
 e.preventDefault();
 setFormError(null);
 if (!receiptClientId.trim()) {
 setFormError('Select a billing client.');
 return;
 }
 if (receiptAmountNum == null || receiptAmountNum <= 0) {
 setFormError('Enter a positive receipt amount.');
 return;
 }

 const rows: { invoiceId: string; amount: number }[] = [];
 for (const row of allocations) {
 if (!row.invoiceId.trim()) continue;
 const n = parseFloat(String(row.amount).replace(/,/g, ''));
 if (!Number.isFinite(n) || n <= 0) {
 setFormError('Each allocation needs a positive amount.');
 return;
 }
 rows.push({ invoiceId: row.invoiceId.trim(), amount: Math.round(n * 100) / 100 });
 }

 if (rows.length < 1) {
 setFormError('Add at least one allocation to an invoice.');
 return;
 }

 const sum = rows.reduce((s, r) => s + r.amount, 0);
 if (Math.abs(sum - receiptAmountNum) > 0.02) {
 setFormError(
 `Allocations sum (${sum.toFixed(2)}) must equal receipt amount (${receiptAmountNum.toFixed(2)}).`,
 );
 return;
 }

 setSubmitting(true);
 try {
 const r = await fetch('/api/accounts/client-payments', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 clientId: receiptClientId.trim(),
 receivedAt: receivedAt.trim(),
 amount: receiptAmountNum,
 reference: reference.trim() || null,
 method: method.trim() || null,
 notes: notes.trim() || null,
 allocations: rows,
 }),
 });
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
 setAmount('');
 setReference('');
 setMethod('');
 setNotes('');
 setAllocations([{ invoiceId: '', amount: '' }]);
 loadPayments();
 loadOpenInvoices(receiptClientId);
 } catch (err) {
 setFormError(err instanceof Error ? err.message : 'Could not save receipt');
 } finally {
 setSubmitting(false);
 }
 };

 const clientsSorted = useMemo(() => {
 const list = [...(clients ?? [])];
 list.sort((a, b) => a.name.localeCompare(b.name));
 return list;
 }, [clients]);

 if (clients === null) {
 return (
 <div className="flex items-center gap-2 text-[var(--dash-text-muted)] py-12">
 <Loader2 className="w-5 h-5 animate-spin" />
 Loading…
 </div>
 );
 }

 return (
 <DashboardPage>
 <DashboardPageHeader
 icon={Wallet}
 title="Receipts & allocations"
 description="Record money received from billing clients and split it across one or more invoices. Invoice status updates from allocated amounts."
 />

 {listError && (
 <div className="rounded-xl border border-[var(--dash-warning-border)] bg-[var(--dash-warning-bg)] px-4 py-3 text-sm text-[var(--dash-warning-fg)] flex gap-2">
 <AlertCircle className="w-5 h-5 shrink-0" />
 {listError}
 </div>
 )}

 {!canManagePayments && (
 <div className="dash-banner-info rounded-xl border px-4 py-3 text-sm">
 <Building2 className="w-4 h-4 inline-block mr-2 align-text-bottom text-[var(--dash-text-muted)]" />
 You can view receipts below. Recording requires{' '}
 <strong className="font-semibold">Payments</strong> permission on your Accounts access profile (or admin
 role).
 </div>
 )}

 <div
 className={`grid grid-cols-1 gap-6 xl:gap-8 items-start min-w-0 ${canManagePayments ? 'xl:grid-cols-2' : ''}`}
 >
 {canManagePayments && (
 <form
 onSubmit={submit}
 className="dashboard-surface p-5 sm:p-6 shadow-sm space-y-5 min-w-0"
 >
 <p className={sectionLabelClass}>New receipt</p>
 {formError && (
 <div className="rounded-xl border border-[var(--dash-danger-border)] bg-[var(--dash-danger-bg)] px-4 py-3 text-sm text-[var(--dash-danger-fg)] flex gap-2">
 <AlertCircle className="w-5 h-5 shrink-0" />
 {formError}
 </div>
 )}

 <div className="grid sm:grid-cols-2 gap-4">
 <div className="sm:col-span-2">
 <label htmlFor="client" className={labelClass}>
 Billing client *
 </label>
 <div className="flex gap-2 items-start">
 <select
 id="client"
 required
 className={inputClass}
 value={receiptClientId}
 onChange={(e) => setReceiptClientId(e.target.value)}
 >
 <option value="">Select…</option>
 {clientsSorted.map((c) => (
 <option key={c.id} value={c.id}>
 {c.name} · {c.currency}
 </option>
 ))}
 </select>
 </div>
 <p className="text-xs text-[var(--dash-text-muted)] mt-1.5">
 <Link
 href="/dashboard/accounts/clients"
 className="font-medium text-[var(--brand-primary)] hover:underline"
 >
 Billing clients
 </Link>
 {' · '}
 <Link
 href="/dashboard/accounts/invoices"
 className="font-medium text-[var(--brand-primary)] hover:underline"
 >
 Invoices
 </Link>
 </p>
 </div>
 <div>
 <label htmlFor="recv" className={labelClass}>
 Received on *
 </label>
 <input
 id="recv"
 type="date"
 required
 className={inputClass}
 value={receivedAt}
 onChange={(e) => setReceivedAt(e.target.value)}
 />
 </div>
 <div>
 <label htmlFor="amt" className={labelClass}>
 Amount received *
 {selectedClient ? ` (${selectedClient.currency})` : ''}
 </label>
 <input
 id="amt"
 className={inputClass}
 value={amount}
 onChange={(e) => setAmount(e.target.value)}
 placeholder="0.00"
 required
 />
 </div>
 <div>
 <label htmlFor="ref" className={labelClass}>
 Reference
 </label>
 <input
 id="ref"
 className={inputClass}
 value={reference}
 onChange={(e) => setReference(e.target.value)}
 placeholder="Bank ref / Mpesa code"
 />
 </div>
 <div>
 <label htmlFor="meth" className={labelClass}>
 Method
 </label>
 <input
 id="meth"
 className={inputClass}
 value={method}
 onChange={(e) => setMethod(e.target.value)}
 placeholder="e.g. Bank, Mpesa"
 />
 </div>
 <div className="sm:col-span-2">
 <label htmlFor="notes" className={labelClass}>
 Notes
 </label>
 <textarea
 id="notes"
 rows={2}
 className={`${inputClass} resize-y`}
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 />
 </div>
 </div>

 <div className="border-t border-[var(--dash-border-subtle)] pt-4 space-y-3">
 <div className="flex items-center justify-between gap-2 flex-wrap">
 <p className="text-sm font-semibold text-[var(--dash-text-strong)]">Allocate to invoices</p>
 <button
 type="button"
 onClick={addAllocRow}
 className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-primary)] hover:opacity-80"
 >
 <Plus className="w-4 h-4" />
 Add row
 </button>
 </div>
 {invoicesError && (
 <p className="text-sm text-[var(--dash-warning-fg)] bg-[var(--dash-warning-bg)] border border-[var(--dash-warning-border)] rounded-lg px-3 py-2">
 {invoicesError}
 </p>
 )}
 {!receiptClientId.trim() ? (
 <p className="text-sm text-[var(--dash-text-muted)]">Select a client to load open invoices.</p>
 ) : openInvoices && openInvoices.length === 0 ? (
 <p className="text-sm text-[var(--dash-text-muted)]">No unpaid / partial invoices for this client.</p>
 ) : null}

 <div className="space-y-3">
 {allocations.map((row, index) => (
 <div
 key={index}
 className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-muted)]"
 >
 <div className="md:col-span-7">
 <label className="block text-xs font-medium text-[var(--dash-text-muted)] mb-1">Invoice</label>
 <select
 className={inputClass}
 value={row.invoiceId}
 onChange={(e) => updateAlloc(index, { invoiceId: e.target.value })}
 >
 <option value="">Select…</option>
 {(openInvoices ?? []).map((inv) => (
 <option key={inv.id} value={inv.id}>
 #{inv.invoiceNumber} · {inv.issueDate} · balance{' '}
 {inv.balanceDue != null
 ? money(Math.max(0, inv.balanceDue), inv.currency)
 : money(inv.totalIncVat, inv.currency)}
 </option>
 ))}
 </select>
 </div>
 <div className="md:col-span-4">
 <label className="block text-xs font-medium text-[var(--dash-text-muted)] mb-1">Amount</label>
 <input
 className={inputClass}
 value={row.amount}
 onChange={(e) => updateAlloc(index, { amount: e.target.value })}
 placeholder="0.00"
 />
 </div>
 <div className="md:col-span-1 flex items-end gap-1">
 <button
 type="button"
 onClick={() => fillBalance(index)}
 className="mb-0.5 text-[11px] font-medium text-[var(--brand-primary)] hover:underline px-1"
 title="Fill remaining balance for selected invoice"
 >
 Due
 </button>
 <button
 type="button"
 onClick={() => removeAllocRow(index)}
 className="p-2 rounded-lg text-[var(--dash-text-muted)] hover:bg-[var(--dash-danger-bg)] hover:text-[var(--dash-danger-fg)]"
 aria-label="Remove row"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 ))}
 </div>
 {receiptAmountNum != null && receiptAmountNum > 0 && (
 <p className="text-sm text-[var(--dash-text-muted)]">
 Allocations sum:{' '}
 <span className="font-semibold tabular-nums text-[var(--dash-text-strong)]">
 {allocationTotal.toFixed(2)}
 </span>
 {' · '}
 Receipt:{' '}
 <span className="font-semibold tabular-nums text-[var(--dash-text-strong)]">
 {receiptAmountNum.toFixed(2)}
 </span>
 {Math.abs(allocationTotal - receiptAmountNum) > 0.02 && (
 <span className="text-[var(--dash-warning-fg)] ml-2">Must match before saving.</span>
 )}
 </p>
 )}
 </div>

 <button
 type="submit"
 disabled={submitting || !receiptClientId.trim()}
 className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60"
 >
 {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
 Record receipt
 </button>
 </form>
 )}

 <section className="dashboard-surface shadow-sm overflow-hidden min-w-0">
 <div className="dashboard-panel-header px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <h2 className="text-sm font-bold text-[var(--dash-text-strong)] uppercase tracking-wide">Recent receipts</h2>
 <div className="flex items-center gap-2">
 <label htmlFor="filterClient" className="text-xs text-[var(--dash-text-muted)] whitespace-nowrap">
 Filter by client
 </label>
 <select
 id="filterClient"
 className={`dash-filter-select rounded-lg px-3 py-2 text-sm max-w-[220px]`}
 value={listFilterClientId}
 onChange={(e) => setListFilterClientId(e.target.value)}
 >
 <option value="">All clients</option>
 {clientsSorted.map((c) => (
 <option key={c.id} value={c.id}>
 {c.name}
 </option>
 ))}
 </select>
 </div>
 </div>
 <p className="px-4 py-2 text-xs text-[var(--dash-text-subtle)] border-b border-[var(--dash-border-subtle)]">
 Filter only affects this list. The new receipt form uses its own client selection above.
 </p>
 {payments === null ? (
 <div className="flex justify-center py-12 text-[var(--dash-text-muted)]">
 <Loader2 className="w-5 h-5 animate-spin" />
 </div>
 ) : payments.length === 0 ? (
 <p className="p-8 text-center text-sm text-[var(--dash-text-muted)]">No receipts recorded yet.</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full min-w-[640px] text-sm">
 <thead>
 <tr>
 <th className="px-4 py-3 font-semibold col-center">Received</th>
 <th className="px-4 py-3 font-semibold">Client</th>
 <th className="px-4 py-3 font-semibold col-center">Amount</th>
 <th className="px-4 py-3 font-semibold">Ref / method</th>
 <th className="px-4 py-3 font-semibold">Allocations</th>
 </tr>
 </thead>
 <tbody>
 {payments.map((p) => (
 <tr key={p.id} className="transition-colors">
 <td className="px-4 py-3 col-center tabular-nums">{p.receivedAt}</td>
 <td className="px-4 py-3">{p.clientName}</td>
 <td className="px-4 py-3 col-center font-medium tabular-nums">
 {money(p.amount, p.clientCurrency)}
 </td>
 <td className="px-4 py-3 text-xs text-[var(--dash-text-muted)]">
 {[p.reference, p.method].filter(Boolean).join(' · ') || '—'}
 </td>
 <td className="px-4 py-3 text-xs">
 <ul className="space-y-0.5">
 {p.allocations.map((a) => (
 <li key={a.id}>
 Invoice #{a.invoiceNumber}: {money(a.amount, p.clientCurrency)}{' '}
 <Link
 href={`/dashboard/accounts/invoices/${a.invoiceId}`}
 className="text-[var(--brand-primary)] hover:underline"
 >
 view
 </Link>
 </li>
 ))}
 </ul>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </section>
 </div>
 </DashboardPage>
 );
}

export default function AccountsReceiptsPage() {
 return (
 <Suspense
 fallback={
 <div className="flex items-center gap-2 text-[var(--dash-text-muted)] py-12 justify-center">
 <Loader2 className="w-5 h-5 animate-spin" />
 Loading…
 </div>
 }
 >
 <ReceiptsPageInner />
 </Suspense>
 );
}
