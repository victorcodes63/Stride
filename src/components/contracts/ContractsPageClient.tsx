'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileSignature, Plus, Search } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type ContractItem = {
 id: string;
 title: string | null;
 reference: string | null;
 contractType: 'employee' | 'consultant';
 startDate: string | null;
 endDate: string;
 remindersDisabled: boolean;
 managers: Array<{ id: string; name: string; email: string }>;
};

type StaffUser = { id: string; name: string; email: string };

export default function ContractsPageClient() {
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [contracts, setContracts] = useState<ContractItem[]>([]);
 const [managers, setManagers] = useState<StaffUser[]>([]);
 const [query, setQuery] = useState('');
 const [error, setError] = useState<string | null>(null);
 const [openCreate, setOpenCreate] = useState(false);
 const [renewingId, setRenewingId] = useState<string | null>(null);
 const [form, setForm] = useState({
 contractType: 'employee' as 'employee' | 'consultant',
 partyName: '',
 reference: '',
 startDate: '',
 endDate: '',
 remindersDisabled: false,
 managerIds: [] as string[],
 });

 const loadContracts = async () => {
 setLoading(true);
 setError(null);
 try {
 const res = await fetch('/api/people/contracts');
 const data = await res.json().catch(() => []);
 if (!res.ok) throw new Error(data.error || 'Failed to load contracts');
 setContracts(Array.isArray(data) ? data : []);
 } catch (e) {
 setContracts([]);
 setError(e instanceof Error ? e.message : 'Failed to load contracts');
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void loadContracts();
 }, []);

 useEffect(() => {
 fetch('/api/users?contractManagerPicker=1')
 .then((r) => (r.ok ? r.json() : []))
 .then((data) => {
 if (Array.isArray(data)) {
 setManagers(data.map((u) => ({ id: u.id, name: u.name, email: u.email })));
 } else {
 setManagers([]);
 }
 })
 .catch(() => setManagers([]));
 }, []);

 const filtered = useMemo(() => {
 const q = query.trim().toLowerCase();
 if (!q) return contracts;
 return contracts.filter((c) =>
 [
 c.title ?? '',
 c.reference ?? '',
 c.contractType,
 c.managers.map((m) => m.name).join(' '),
 ]
 .join(' ')
 .toLowerCase()
 .includes(q),
 );
 }, [contracts, query]);

 const stats = useMemo(() => {
 const total = contracts.length;
 const employees = contracts.filter((c) => c.contractType === 'employee').length;
 const consultants = contracts.filter((c) => c.contractType === 'consultant').length;
 return { total, employees, consultants };
 }, [contracts]);

 const getStatus = (endDate: string) => {
 const now = new Date();
 const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
 const end = new Date(`${endDate}T00:00:00`);
 const diffDays = Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
 if (diffDays < 0) return { label: 'Expired', className: 'bg-red-50 text-red-700' };
 if (diffDays <= 30) return { label: 'Expiring', className: 'bg-amber-50 text-amber-700' };
 return { label: 'Active', className: 'bg-emerald-50 text-emerald-700' };
 };

 const handleCreate = async (e: React.FormEvent) => {
 e.preventDefault();
 setSubmitting(true);
 setError(null);
 try {
 const res = await fetch('/api/people/contracts', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(form),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to create contract');
 setOpenCreate(false);
 setForm({
 contractType: 'employee',
 partyName: '',
 reference: '',
 startDate: '',
 endDate: '',
 remindersDisabled: false,
 managerIds: [],
 });
 await loadContracts();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to create contract');
 } finally {
 setSubmitting(false);
 }
 };

 const handleQuickRenew = async (contractId: string, currentEndDate: string) => {
 setRenewingId(contractId);
 setError(null);
 try {
 const current = new Date(`${currentEndDate}T12:00:00`);
 const nextStart = new Date(current);
 nextStart.setDate(nextStart.getDate() + 1);
 const nextEnd = new Date(nextStart);
 nextEnd.setMonth(nextEnd.getMonth() + 12);

 const res = await fetch(`/api/people/contracts/${contractId}/renew`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 newStartDate: nextStart.toISOString().slice(0, 10),
 newEndDate: nextEnd.toISOString().slice(0, 10),
 }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to renew contract');
 await loadContracts();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to renew contract');
 } finally {
 setRenewingId(null);
 }
 };

 return (
 <div className="w-full min-w-0">
 <DashboardPageHeader
 title="Contracts"
 icon={FileSignature}
 description="Manage both employee contracts and consultant doctor contracts with renewal reminders."
 actions={
 <button
 type="button"
 onClick={() => setOpenCreate((v) => !v)}
 className="btn-primary inline-flex items-center gap-2"
 >
 <Plus className="h-4 w-4" />
 {openCreate ? 'Close form' : 'New contract'}
 </button>
 }
 className="mb-5"
 />

 {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

 <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
 <div className="dashboard-stat-card">
 <p className="text-xs text-neutral-500">Total contracts</p>
 <p className="text-2xl font-semibold text-neutral-900 tabular-nums">{stats.total}</p>
 </div>
 <div className="dashboard-stat-card">
 <p className="text-xs text-neutral-500">Employee contracts</p>
 <p className="text-2xl font-semibold text-neutral-900 tabular-nums">{stats.employees}</p>
 </div>
 <div className="dashboard-stat-card">
 <p className="text-xs text-neutral-500">Consultant doctor contracts</p>
 <p className="text-2xl font-semibold text-neutral-900 tabular-nums">{stats.consultants}</p>
 </div>
 </div>

 {openCreate ? (
 <form onSubmit={handleCreate} className="mb-4 dashboard-stat-card">
 <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
 <select
 value={form.contractType}
 onChange={(e) => setForm((f) => ({ ...f, contractType: e.target.value as 'employee' | 'consultant' }))}
 className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 >
 <option value="employee">Employee contract</option>
 <option value="consultant">Consultant doctor contract</option>
 </select>
 <input
 value={form.partyName}
 onChange={(e) => setForm((f) => ({ ...f, partyName: e.target.value }))}
 placeholder={form.contractType === 'employee' ? 'Employee full name' : 'Consultant doctor full name'}
 className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 required
 />
 <input
 value={form.reference}
 onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
 placeholder="Reference (optional, e.g. 2026-014)"
 className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 />
 <div className="grid grid-cols-2 gap-2">
 <input
 type="date"
 value={form.startDate}
 onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
 className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 />
 <input
 type="date"
 value={form.endDate}
 onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
 className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 required
 />
 </div>
 </div>

 {managers.length ? (
 <div className="mt-3">
 <p className="mb-1 text-xs font-medium text-neutral-600">Contract managers</p>
 <div className="flex flex-wrap gap-2">
 {managers.map((m) => {
 const checked = form.managerIds.includes(m.id);
 return (
 <label key={m.id} className="inline-flex items-center gap-1 rounded border border-neutral-200 px-2 py-1 text-xs">
 <input
 type="checkbox"
 checked={checked}
 onChange={(e) =>
 setForm((f) => ({
 ...f,
 managerIds: e.target.checked
 ? [...f.managerIds, m.id]
 : f.managerIds.filter((id) => id !== m.id),
 }))
 }
 />
 {m.name}
 </label>
 );
 })}
 </div>
 </div>
 ) : null}

 <label className="mt-3 inline-flex items-center gap-2 text-sm text-neutral-700">
 <input
 type="checkbox"
 checked={form.remindersDisabled}
 onChange={(e) => setForm((f) => ({ ...f, remindersDisabled: e.target.checked }))}
 />
 Disable expiry reminders
 </label>

 <div className="mt-3">
 <button
 type="submit"
 disabled={submitting}
 className="rounded-lg bg-primary-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
 >
 {submitting ? 'Saving...' : 'Save contract'}
 </button>
 </div>
 </form>
 ) : null}

 <div className="mb-3 flex items-center gap-2 dashboard-surface p-3">
 <Search className="h-4 w-4 text-neutral-400" />
 <input
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 placeholder="Search by name, reference, type, or manager..."
 className="w-full border-0 p-0 text-sm focus:outline-none"
 />
 </div>

 <div className="overflow-hidden dashboard-surface">
 {loading ? (
 <div className="p-6 text-sm text-neutral-500">Loading contracts...</div>
 ) : filtered.length === 0 ? (
 <div className="p-6 text-sm text-neutral-500">No contracts found.</div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full min-w-[860px] text-sm">
 <thead className="bg-neutral-50">
 <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
 <th className="px-4 py-3">Type</th>
 <th className="px-4 py-3">Contract party</th>
 <th className="px-4 py-3">Reference</th>
 <th className="px-4 py-3">Start</th>
 <th className="px-4 py-3">End</th>
 <th className="px-4 py-3">Status</th>
 <th className="px-4 py-3">Managers</th>
 <th className="px-4 py-3">Reminders</th>
 <th className="px-4 py-3 text-right">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-neutral-100">
 {filtered.map((c) => (
 <tr key={c.id}>
 <td className="px-4 py-3">
 <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
 c.contractType === 'consultant' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
 }`}>
 {c.contractType === 'consultant' ? 'Consultant' : 'Employee'}
 </span>
 </td>
 <td className="px-4 py-3 font-medium text-neutral-900">{c.title || '-'}</td>
 <td className="px-4 py-3 text-neutral-600">{c.reference || '-'}</td>
 <td className="px-4 py-3 text-neutral-600">{c.startDate || '-'}</td>
 <td className="px-4 py-3 text-neutral-700">{c.endDate}</td>
 <td className="px-4 py-3">
 {(() => {
 const status = getStatus(c.endDate);
 return (
 <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
 {status.label}
 </span>
 );
 })()}
 </td>
 <td className="px-4 py-3 text-neutral-600">
 {c.managers.length ? c.managers.map((m) => m.name).join(', ') : '—'}
 </td>
 <td className="px-4 py-3 text-neutral-600">{c.remindersDisabled ? 'Disabled' : 'Enabled'}</td>
 <td className="px-4 py-3 text-right">
 <div className="inline-flex items-center gap-3">
 <button
 type="button"
 onClick={() => handleQuickRenew(c.id, c.endDate)}
 disabled={renewingId === c.id}
 className="text-xs text-emerald-700 hover:underline disabled:opacity-60"
 >
 {renewingId === c.id ? 'Renewing...' : 'Renew'}
 </button>
 <Link href={`/dashboard/people/contracts/${c.id}`} className="text-primary-700 hover:underline">
 Open
 </Link>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </div>
 );
}

