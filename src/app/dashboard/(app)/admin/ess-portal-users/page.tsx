'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, UserCog } from 'lucide-react';
import type { EssPortalRole, EssPortalUserSummary } from '@/types/dashboard';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

const ROLE_OPTIONS: { value: EssPortalRole; label: string }[] = [
 { value: 'employee', label: 'Employee' },
 { value: 'manager', label: 'Manager' },
 { value: 'hr', label: 'HR' },
];

export default function EssPortalUsersPage() {
 const [items, setItems] = useState<EssPortalUserSummary[]>([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [editId, setEditId] = useState<string | null>(null);
 const [createOpen, setCreateOpen] = useState(false);
 const [syncing, setSyncing] = useState(false);
 const [q, setQ] = useState('');
 const [form, setForm] = useState({
 name: '',
 email: '',
 password: '',
 role: 'employee' as EssPortalRole,
 notes: '',
 mustResetPassword: true,
 });

 async function load() {
 setLoading(true);
 setError(null);
 try {
 const res = await fetch('/api/admin/ess-portal-users');
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to load ESS users.');
 setItems(Array.isArray(data) ? data : []);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to load ESS users.');
 } finally {
 setLoading(false);
 }
 }

 useEffect(() => {
 void load();
 }, []);

 const filtered = useMemo(() => {
 const query = q.trim().toLowerCase();
 if (!query) return items;
 return items.filter((item) => {
 return (
 item.name.toLowerCase().includes(query) ||
 item.email.toLowerCase().includes(query) ||
 (item.employeeName || '').toLowerCase().includes(query) ||
 item.role.toLowerCase().includes(query)
 );
 });
 }, [items, q]);

 async function handleCreate(e: React.FormEvent) {
 e.preventDefault();
 setSaving(true);
 setError(null);
 try {
 const res = await fetch('/api/admin/ess-portal-users', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(form),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to create ESS user.');
 setItems((prev) => [data, ...prev]);
 setCreateOpen(false);
 setForm({ name: '', email: '', password: '', role: 'employee', notes: '', mustResetPassword: true });
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to create ESS user.');
 } finally {
 setSaving(false);
 }
 }

 async function toggleActive(item: EssPortalUserSummary) {
 setEditId(item.id);
 setError(null);
 try {
 const res = await fetch(`/api/admin/ess-portal-users/${item.id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ isActive: !item.isActive }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to update ESS user.');
 setItems((prev) => prev.map((row) => (row.id === item.id ? data : row)));
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to update ESS user.');
 } finally {
 setEditId(null);
 }
 }

 async function syncEmployeesToEss() {
 setSyncing(true);
 setError(null);
 try {
 const res = await fetch('/api/admin/ess-portal-users/sync-employees', {
 method: 'POST',
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to sync employees to ESS.');
 await load();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to sync employees to ESS.');
 } finally {
 setSyncing(false);
 }
 }

 return (
 <DashboardPage>
 <DashboardPageHeader
 icon={UserCog}
 title="ESS portal users"
 description="Provision and manage employee self-service accounts."
 actions={
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={syncEmployeesToEss}
 disabled={syncing}
 className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
 >
 {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
 Sync employees
 </button>
 <button
 type="button"
 onClick={() => setCreateOpen(true)}
 className="btn-primary inline-flex items-center gap-2"
 >
 <Plus className="w-4 h-4" />
 Add ESS user
 </button>
 </div>
 }
 />

 {error && <p className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-100">{error}</p>}

 <div className="dashboard-surface shadow-sm">
 <div className="p-4 border-b border-neutral-200">
 <input
 value={q}
 onChange={(e) => setQ(e.target.value)}
 placeholder="Search by name, email, employee, role..."
 className="w-full max-w-md px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 </div>
 {loading ? (
 <div className="py-16 flex items-center justify-center">
 <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full text-left min-w-[860px]">
 <thead className="bg-neutral-50 border-b border-neutral-200">
 <tr>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Name</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Email</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Employee</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase col-center">Role</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase col-center">Status</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase col-center">Last login</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase col-right">Actions</th>
 </tr>
 </thead>
 <tbody>
 {filtered.map((item) => (
 <tr key={item.id} className="border-b border-neutral-100">
 <td className="px-4 py-3 text-sm font-medium text-primary-900">{item.name}</td>
 <td className="px-4 py-3 text-sm text-neutral-700">{item.email}</td>
 <td className="px-4 py-3 text-sm text-neutral-600">{item.employeeName || '—'}</td>
 <td className="px-4 py-3 text-sm text-neutral-700 capitalize col-center">{item.role}</td>
 <td className="px-4 py-3 text-sm col-center">
 <span className={`px-2 py-1 rounded-md text-xs font-medium ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>
 {item.isActive ? 'Active' : 'Inactive'}
 </span>
 </td>
 <td className="px-4 py-3 text-sm text-neutral-600 col-center tabular-nums">
 {item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : 'Never'}
 </td>
 <td className="px-4 py-3 col-right">
 <button
 type="button"
 onClick={() => toggleActive(item)}
 disabled={editId === item.id}
 className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
 >
 {editId === item.id ? 'Saving...' : item.isActive ? 'Deactivate' : 'Activate'}
 </button>
 </td>
 </tr>
 ))}
 {!filtered.length && (
 <tr>
 <td colSpan={7} className="px-4 py-10 text-center text-sm text-neutral-500">
 No ESS users found.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {createOpen && (
 <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center" onClick={() => !saving && setCreateOpen(false)}>
 <div className="w-full max-w-xl bg-white rounded-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
 <div className="px-4 py-3 border-b border-neutral-200">
 <h2 className="text-lg font-semibold text-primary-900">Add ESS user</h2>
 </div>
 <form onSubmit={handleCreate} className="p-4 space-y-4">
 <div className="grid sm:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
 <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm" />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
 <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm" />
 </div>
 </div>
 <div className="grid sm:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
 <input type="password" minLength={6} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm" />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Role</label>
 <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as EssPortalRole }))} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm">
 {ROLE_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>
 {opt.label}
 </option>
 ))}
 </select>
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Notes (optional)</label>
 <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm" />
 </div>
 <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
 <input type="checkbox" checked={form.mustResetPassword} onChange={(e) => setForm((f) => ({ ...f, mustResetPassword: e.target.checked }))} />
 Force password reset on first login
 </label>
 <div className="flex justify-end gap-2 pt-2">
 <button type="button" onClick={() => !saving && setCreateOpen(false)} className="px-4 py-2 border border-neutral-300 rounded-lg text-sm">
 Cancel
 </button>
 <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60">
 {saving ? 'Saving...' : 'Create ESS user'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </DashboardPage>
 );
}
