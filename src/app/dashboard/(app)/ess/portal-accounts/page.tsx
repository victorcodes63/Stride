'use client';

import { useEffect, useMemo, useState } from 'react';
import {
 Loader2,
 Plus,
 RefreshCw,
 Search,
 Smartphone,
 UserCheck,
 UserX,
 Mail,
 MoreHorizontal,
 Shield,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type PortalRole = 'employee' | 'manager' | 'hr';
type PortalAccount = {
 id: string;
 name: string;
 email: string;
 role: PortalRole;
 isActive: boolean;
 employeeName: string | null;
 employeeNumber: string | null;
 department: string | null;
 lastLoginAt: string | null;
 createdAt: string;
};

const ROLE_OPTIONS: { value: PortalRole; label: string; description: string }[] = [
 { value: 'employee', label: 'Employee', description: 'View own records, request leave, clock in/out' },
 { value: 'manager', label: 'Manager', description: 'Approve leave, view team attendance & reports' },
 { value: 'hr', label: 'HR', description: 'Full access to all ESS administrative features' },
];

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
 return (
 <div className={`dashboard-stat-card shadow-sm ${accent}`}>
 <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
 <p className="mt-2 text-2xl font-bold tabular-nums text-primary-900">{value}</p>
 </div>
 );
}

export default function PortalAccountsPage() {
 const [accounts, setAccounts] = useState<PortalAccount[]>([]);
 const [loading, setLoading] = useState(true);
 const [syncing, setSyncing] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);
 const [q, setQ] = useState('');
 const [roleFilter, setRoleFilter] = useState('');
 const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
 const [createOpen, setCreateOpen] = useState(false);
 const [saving, setSaving] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [actionMenuId, setActionMenuId] = useState<string | null>(null);
 const [form, setForm] = useState({
 name: '',
 email: '',
 password: '',
 role: 'employee' as PortalRole,
 mustResetPassword: true,
 });

 async function load() {
 setLoading(true);
 setError(null);
 try {
 const res = await fetch('/api/admin/ess-portal-users');
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to load portal accounts.');
 setAccounts(Array.isArray(data) ? data : []);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to load portal accounts.');
 } finally {
 setLoading(false);
 }
 }

 useEffect(() => {
 void load();
 }, []);

 const filtered = useMemo(() => {
 let result = accounts;
 if (statusFilter === 'active') result = result.filter((a) => a.isActive);
 if (statusFilter === 'inactive') result = result.filter((a) => !a.isActive);
 if (roleFilter) result = result.filter((a) => a.role === roleFilter);
 const query = q.trim().toLowerCase();
 if (query) {
 result = result.filter(
 (a) =>
 a.name.toLowerCase().includes(query) ||
 a.email.toLowerCase().includes(query) ||
 (a.employeeName || '').toLowerCase().includes(query) ||
 (a.employeeNumber || '').toLowerCase().includes(query) ||
 (a.department || '').toLowerCase().includes(query),
 );
 }
 return result;
 }, [accounts, q, roleFilter, statusFilter]);

 const stats = useMemo(() => {
 const total = accounts.length;
 const active = accounts.filter((a) => a.isActive).length;
 const inactive = total - active;
 const managers = accounts.filter((a) => a.role === 'manager' || a.role === 'hr').length;
 return { total, active, inactive, managers };
 }, [accounts]);

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
 if (!res.ok) throw new Error(data.error || 'Failed to create account.');
 setAccounts((prev) => [data, ...prev]);
 setCreateOpen(false);
 setForm({ name: '', email: '', password: '', role: 'employee', mustResetPassword: true });
 setSuccess('Portal account created successfully.');
 setTimeout(() => setSuccess(null), 4000);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to create account.');
 } finally {
 setSaving(false);
 }
 }

 async function toggleStatus(account: PortalAccount) {
 setEditingId(account.id);
 setError(null);
 try {
 const res = await fetch(`/api/admin/ess-portal-users/${account.id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ isActive: !account.isActive }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to update account.');
 setAccounts((prev) => prev.map((row) => (row.id === account.id ? data : row)));
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to update account.');
 } finally {
 setEditingId(null);
 setActionMenuId(null);
 }
 }

 async function resetPassword(account: PortalAccount) {
 setEditingId(account.id);
 setError(null);
 try {
 const res = await fetch(`/api/admin/ess-portal-users/${account.id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ mustResetPassword: true }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to reset password.');
 setAccounts((prev) => prev.map((row) => (row.id === account.id ? data : row)));
 setSuccess(`Password reset flagged for ${account.name}. They will be prompted on next login.`);
 setTimeout(() => setSuccess(null), 4000);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to reset password.');
 } finally {
 setEditingId(null);
 setActionMenuId(null);
 }
 }

 async function syncEmployees() {
 setSyncing(true);
 setError(null);
 try {
 const res = await fetch('/api/admin/ess-portal-users/sync-employees', { method: 'POST' });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to sync employees.');
 await load();
 setSuccess(`Sync complete. ${data.created ?? 0} new accounts provisioned.`);
 setTimeout(() => setSuccess(null), 4000);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to sync employees.');
 } finally {
 setSyncing(false);
 }
 }

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Portal accounts"
 icon={Smartphone}
 description="Provision and manage employee self-service portal access."
 actions={
 <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={syncEmployees}
 disabled={syncing}
 className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
 >
 {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
 Sync from employees
 </button>
 <button
 type="button"
 onClick={() => setCreateOpen(true)}
 className="btn-primary inline-flex items-center gap-2"
 >
 <Plus className="h-4 w-4" />
 Add account
 </button>
 </div>
 }
 />

 {error && (
 <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3 border border-red-100">{error}</div>
 )}
 {success && (
 <div className="mb-4 rounded-lg bg-emerald-50 text-emerald-700 text-sm px-4 py-3 border border-emerald-100">
 {success}
 </div>
 )}

 <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
 <StatCard label="Total accounts" value={stats.total} accent="border-l-4 border-l-primary-500" />
 <StatCard label="Active" value={stats.active} accent="border-l-4 border-l-emerald-500" />
 <StatCard label="Inactive" value={stats.inactive} accent="border-l-4 border-l-neutral-400" />
 <StatCard label="Managers / HR" value={stats.managers} accent="border-l-4 border-l-amber-500" />
 </section>

 <div className="dashboard-surface shadow-sm">
 <div className="p-4 border-b border-neutral-200">
 <div className="flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
 <input
 value={q}
 onChange={(e) => setQ(e.target.value)}
 placeholder="Search name, email, employee no, department..."
 className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 </div>
 <select
 value={roleFilter}
 onChange={(e) => setRoleFilter(e.target.value)}
 className="h-10 px-3 border border-neutral-300 rounded-lg text-sm bg-white"
 >
 <option value="">All roles</option>
 {ROLE_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
 className="h-10 px-3 border border-neutral-300 rounded-lg text-sm bg-white"
 >
 <option value="all">All statuses</option>
 <option value="active">Active</option>
 <option value="inactive">Inactive</option>
 </select>
 </div>
 <p className="mt-2 text-xs text-neutral-500">
 Showing {filtered.length} of {accounts.length} accounts
 </p>
 </div>

 {loading ? (
 <div className="py-16 flex items-center justify-center">
 <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full min-w-[900px]">
 <thead className="bg-neutral-50 border-b border-neutral-200">
 <tr>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Employee</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Email</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Department</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase col-center">Role</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase col-center">Status</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase col-center">Last login</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase col-right">Actions</th>
 </tr>
 </thead>
 <tbody>
 {filtered.map((account) => (
 <tr key={account.id} className="border-b border-neutral-100 hover:bg-neutral-50/50">
 <td className="px-4 py-3">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-semibold">
 {account.name.charAt(0).toUpperCase()}
 </div>
 <div>
 <p className="text-sm font-medium text-primary-900">{account.name}</p>
 {account.employeeNumber && (
 <p className="text-xs text-neutral-500">{account.employeeNumber}</p>
 )}
 </div>
 </div>
 </td>
 <td className="px-4 py-3 text-sm text-neutral-700">{account.email}</td>
 <td className="px-4 py-3 text-sm text-neutral-600">{account.department || '—'}</td>
 <td className="px-4 py-3">
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium col-center ${
 account.role === 'hr'
 ? 'bg-purple-50 text-purple-700'
 : account.role === 'manager'
 ? 'bg-amber-50 text-amber-700'
 : 'bg-neutral-100 text-neutral-700'
 }`}>
 {account.role === 'hr' && <Shield className="w-3 h-3" />}
 {account.role.charAt(0).toUpperCase() + account.role.slice(1)}
 </span>
 </td>
 <td className="px-4 py-3 col-center">
 <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
 account.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'
 }`}>
 {account.isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
 {account.isActive ? 'Active' : 'Inactive'}
 </span>
 </td>
 <td className="px-4 py-3 text-sm text-neutral-600 col-center tabular-nums">
 {account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleDateString() : 'Never'}
 </td>
 <td className="px-4 py-3 col-right relative">
 <button
 type="button"
 onClick={() => setActionMenuId(actionMenuId === account.id ? null : account.id)}
 className="p-1.5 rounded-lg hover:bg-neutral-100"
 >
 <MoreHorizontal className="w-4 h-4 text-neutral-600" />
 </button>
 {actionMenuId === account.id && (
 <div className="absolute right-4 top-full z-20 mt-1 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg py-1">
 <button
 type="button"
 onClick={() => toggleStatus(account)}
 disabled={editingId === account.id}
 className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
 >
 {account.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
 {account.isActive ? 'Deactivate' : 'Activate'}
 </button>
 <button
 type="button"
 onClick={() => resetPassword(account)}
 disabled={editingId === account.id}
 className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
 >
 <Mail className="w-4 h-4" />
 Force password reset
 </button>
 </div>
 )}
 </td>
 </tr>
 ))}
 {!filtered.length && (
 <tr>
 <td colSpan={7} className="px-4 py-12 text-center">
 <Smartphone className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
 <p className="text-sm font-medium text-neutral-700">No portal accounts found</p>
 <p className="text-xs text-neutral-500 mt-1">
 Use &ldquo;Sync from employees&rdquo; to auto-provision accounts or add one manually.
 </p>
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
 <div className="px-5 py-4 border-b border-neutral-200">
 <h2 className="text-lg font-semibold text-primary-900">Provision portal account</h2>
 <p className="text-sm text-neutral-600 mt-0.5">
 Create ESS access for an internal employee.
 </p>
 </div>
 <form onSubmit={handleCreate} className="p-5 space-y-4">
 <div className="grid sm:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Full name</label>
 <input
 value={form.name}
 onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
 required
 placeholder="e.g. Jane Muthoni"
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Email address</label>
 <input
 type="email"
 value={form.email}
 onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
 required
 placeholder="jane@company.co.ke"
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 </div>
 </div>
 <div className="grid sm:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Initial password</label>
 <input
 type="password"
 minLength={6}
 value={form.password}
 onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
 required
 placeholder="Min 6 characters"
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Portal role</label>
 <select
 value={form.role}
 onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as PortalRole }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 >
 {ROLE_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 <p className="text-xs text-neutral-500 mt-1">
 {ROLE_OPTIONS.find((o) => o.value === form.role)?.description}
 </p>
 </div>
 </div>
 <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
 <input
 type="checkbox"
 checked={form.mustResetPassword}
 onChange={(e) => setForm((f) => ({ ...f, mustResetPassword: e.target.checked }))}
 className="rounded border-neutral-300"
 />
 Force password reset on first login
 </label>
 <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
 <button
 type="button"
 onClick={() => !saving && setCreateOpen(false)}
 className="px-4 py-2.5 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={saving}
 className="px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
 >
 {saving ? 'Creating...' : 'Create account'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </DashboardPage>
 );
}
