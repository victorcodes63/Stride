'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { AlertCircle, Banknote, Loader2, Plus, Star } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import type { PaymentAccountRow } from '@/lib/payment-accounts';

const inputClass =
 'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30';

type FormState = {
 label: string;
 accountName: string;
 bank: string;
 accountNumber: string;
 bankCode: string;
 branchCode: string;
 swiftCode: string;
 purposeNotes: string;
 isPayrollOnly: boolean;
 isDefault: boolean;
 isActive: boolean;
};

const emptyForm = (): FormState => ({
 label: '',
 accountName: '',
 bank: '',
 accountNumber: '',
 bankCode: '',
 branchCode: '',
 swiftCode: '',
 purposeNotes: '',
 isPayrollOnly: false,
 isDefault: false,
 isActive: true,
});

function formFromAccount(account: PaymentAccountRow): FormState {
 return {
 label: account.label,
 accountName: account.accountName,
 bank: account.bank,
 accountNumber: account.accountNumber,
 bankCode: account.bankCode,
 branchCode: account.branchCode,
 swiftCode: account.swiftCode,
 purposeNotes: account.purposeNotes ?? '',
 isPayrollOnly: account.isPayrollOnly,
 isDefault: account.isDefault,
 isActive: account.isActive,
 };
}

function PaymentAccountsPageInner() {
 const [accounts, setAccounts] = useState<PaymentAccountRow[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [saving, setSaving] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [showForm, setShowForm] = useState(false);
 const [form, setForm] = useState<FormState>(emptyForm());

 const load = useCallback(() => {
 setLoading(true);
 fetch('/api/accounts/payment-accounts')
 .then(async (r) => {
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || `Failed (${r.status})`);
 return data as { accounts?: PaymentAccountRow[] };
 })
 .then((data) => {
 setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
 setError(null);
 })
 .catch((e) => {
 setError(e instanceof Error ? e.message : 'Failed to load');
 setAccounts([]);
 })
 .finally(() => setLoading(false));
 }, []);

 useEffect(() => {
 load();
 }, [load]);

 const startCreate = () => {
 setEditingId(null);
 setForm(emptyForm());
 setShowForm(true);
 setError(null);
 };

 const startEdit = (account: PaymentAccountRow) => {
 setEditingId(account.id);
 setForm(formFromAccount(account));
 setShowForm(true);
 setError(null);
 };

 const cancelForm = () => {
 setShowForm(false);
 setEditingId(null);
 setForm(emptyForm());
 };

 const save = async () => {
 if (!form.label.trim() || !form.accountName.trim() || !form.bank.trim() || !form.accountNumber.trim()) {
 setError('Label, account name, bank, and account number are required.');
 return;
 }
 setSaving(true);
 setError(null);
 try {
 const url = editingId
 ? `/api/accounts/payment-accounts/${editingId}`
 : '/api/accounts/payment-accounts';
 const method = editingId ? 'PATCH' : 'POST';
 const res = await fetch(url, {
 method,
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(form),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Save failed');
 cancelForm();
 load();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Save failed');
 } finally {
 setSaving(false);
 }
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 icon={Banknote}
 title="Payment accounts"
 description="Configure the bank accounts that appear on invoice and credit note PDFs. Staff choose one when creating or editing invoices."
 actions={
 <button
 type="button"
 onClick={startCreate}
 className="btn-primary inline-flex items-center gap-2"
 >
 <Plus className="h-4 w-4" strokeWidth={1.75} />
 Add account
 </button>
 }
 />

 {error && (
 <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
 <p>{error}</p>
 </div>
 )}

 {showForm && (
 <div className="mb-6 dashboard-surface p-5 shadow-sm">
 <h2 className="text-sm font-semibold text-neutral-900 mb-4">
 {editingId ? 'Edit payment account' : 'New payment account'}
 </h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-neutral-800 mb-1.5">Label *</label>
 <input
 className={inputClass}
 value={form.label}
 onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
 placeholder="e.g. Consultancy & other fees"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-800 mb-1.5">Account name *</label>
 <input
 className={inputClass}
 value={form.accountName}
 onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
 placeholder="Legal account holder name"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-800 mb-1.5">Bank *</label>
 <input
 className={inputClass}
 value={form.bank}
 onChange={(e) => setForm((f) => ({ ...f, bank: e.target.value }))}
 placeholder="e.g. Equity Bank"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-800 mb-1.5">Account number *</label>
 <input
 className={inputClass}
 value={form.accountNumber}
 onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
 placeholder="Account number"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-800 mb-1.5">Bank code</label>
 <input
 className={inputClass}
 value={form.bankCode}
 onChange={(e) => setForm((f) => ({ ...f, bankCode: e.target.value }))}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-800 mb-1.5">Branch code</label>
 <input
 className={inputClass}
 value={form.branchCode}
 onChange={(e) => setForm((f) => ({ ...f, branchCode: e.target.value }))}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-800 mb-1.5">SWIFT</label>
 <input
 className={inputClass}
 value={form.swiftCode}
 onChange={(e) => setForm((f) => ({ ...f, swiftCode: e.target.value }))}
 />
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-neutral-800 mb-1.5">Purpose notes</label>
 <textarea
 className={`${inputClass} min-h-[72px]`}
 value={form.purposeNotes}
 onChange={(e) => setForm((f) => ({ ...f, purposeNotes: e.target.value }))}
 placeholder="Shown on PDF, e.g. Payroll only — pay into this account"
 />
 </div>
 </div>
 <div className="mt-4 flex flex-wrap gap-4 text-sm">
 <label className="inline-flex items-center gap-2">
 <input
 type="checkbox"
 checked={form.isPayrollOnly}
 onChange={(e) => setForm((f) => ({ ...f, isPayrollOnly: e.target.checked }))}
 />
 Payroll account
 </label>
 <label className="inline-flex items-center gap-2">
 <input
 type="checkbox"
 checked={form.isDefault}
 onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
 />
 Default on new invoices
 </label>
 <label className="inline-flex items-center gap-2">
 <input
 type="checkbox"
 checked={form.isActive}
 onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
 />
 Active
 </label>
 </div>
 <div className="mt-5 flex gap-2">
 <button
 type="button"
 disabled={saving}
 onClick={save}
 className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-60"
 >
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
 Save
 </button>
 <button
 type="button"
 onClick={cancelForm}
 className="px-4 py-2 rounded-lg border border-neutral-300 text-sm font-medium hover:bg-neutral-50"
 >
 Cancel
 </button>
 </div>
 </div>
 )}

 {loading ? (
 <div className="dashboard-surface shadow-sm p-10 flex justify-center">
 <Loader2 className="w-8 h-8 animate-spin text-primary-700" />
 </div>
 ) : accounts.length === 0 ? (
 <div className="dashboard-surface shadow-sm p-10 text-center">
 <Banknote className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
 <p className="text-neutral-600 mb-4">No payment accounts configured yet.</p>
 <button
 type="button"
 onClick={startCreate}
 className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-900 text-white rounded-lg font-medium hover:bg-primary-800"
 >
 <Plus className="w-4 h-4" />
 Add first account
 </button>
 </div>
 ) : (
 <div className="dashboard-surface shadow-sm overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
 <th className="px-4 py-3 font-semibold">Label</th>
 <th className="px-4 py-3 font-semibold">Bank</th>
 <th className="px-4 py-3 font-semibold">Account number</th>
 <th className="px-4 py-3 font-semibold">Status</th>
 <th className="px-4 py-3 font-semibold text-right">Actions</th>
 </tr>
 </thead>
 <tbody>
 {accounts.map((account) => (
 <tr key={account.id} className="border-b border-neutral-100 last:border-0">
 <td className="px-4 py-3">
 <div className="flex items-center gap-2">
 <span className="font-medium text-neutral-900">{account.label}</span>
 {account.isDefault ? (
 <span className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-800">
 <Star className="w-3 h-3" />
 Default
 </span>
 ) : null}
 {account.isPayrollOnly ? (
 <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
 Payroll
 </span>
 ) : null}
 </div>
 <p className="text-xs text-neutral-500 mt-0.5">{account.accountName}</p>
 </td>
 <td className="px-4 py-3 text-neutral-700">{account.bank}</td>
 <td className="px-4 py-3 tabular-nums text-neutral-700">{account.accountNumber}</td>
 <td className="px-4 py-3">
 <span
 className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${
 account.isActive
 ? 'bg-emerald-50 text-emerald-800'
 : 'bg-neutral-100 text-neutral-600'
 }`}
 >
 {account.isActive ? 'Active' : 'Inactive'}
 </span>
 </td>
 <td className="px-4 py-3 text-right">
 <button
 type="button"
 onClick={() => startEdit(account)}
 className="text-xs font-medium text-primary-800 hover:underline"
 >
 Edit
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </DashboardPage>
 );
}

export default function PaymentAccountsPage() {
 return (
 <Suspense
 fallback={
 <DashboardPage className="flex justify-center py-16">
 <Loader2 className="w-8 h-8 animate-spin text-primary-700" />
 </DashboardPage>
 }
 >
 <PaymentAccountsPageInner />
 </Suspense>
 );
}
