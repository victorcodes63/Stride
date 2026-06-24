'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { UserCog, Plus, X, Loader2, Pencil, Trash2 } from 'lucide-react';
import { STAFF_USER_TYPE_LABELS } from '@/lib/staff-permissions';
import type {
 AccountsPermissionsSummary,
 StaffUserType,
 UserSummary,
 UserRole,
} from '@/types/dashboard';
import { STAFF_USER_TYPES } from '@/types/dashboard';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

const ROLE_LABELS: Record<UserRole, string> = {
 admin: 'Admin',
 staff: 'Staff',
 viewer: 'Viewer',
};

const ROLE_STYLES: Record<UserRole, string> = {
 admin: 'bg-amber-50 text-amber-700',
 staff: 'bg-primary-50 text-primary-700',
 viewer: 'bg-neutral-100 text-neutral-600',
};

function emptyAccounts(): AccountsPermissionsSummary {
 return {
 canManageContracts: false,
 canManageInvoices: false,
 canManagePayments: false,
 canManageVendors: false,
 };
}

function accountsAccessLabel(u: UserSummary): string {
 if (u.role === 'admin') return 'Full';
 if (!u.hasAccountsAccess) return '—';
 const parts: string[] = [];
 if (u.accountsPermissions.canManageContracts) parts.push('contracts');
 if (u.accountsPermissions.canManageInvoices) parts.push('invoices');
 if (u.accountsPermissions.canManagePayments) parts.push('payments');
 if (u.accountsPermissions.canManageVendors) parts.push('vendors');
 return parts.length ? parts.join(', ') : '—';
}

export default function DashboardStaffPage() {
 const [users, setUsers] = useState<UserSummary[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [forbidden, setForbidden] = useState(false);
 const [addOpen, setAddOpen] = useState(false);
 const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
 const [submitting, setSubmitting] = useState(false);
 const [formError, setFormError] = useState<string | null>(null);
 const [deletingId, setDeletingId] = useState<string | null>(null);

 const [addForm, setAddForm] = useState({
 email: '',
 name: '',
 password: '',
 role: 'staff' as UserRole,
 staffUserType: 'operations' as StaffUserType,
 accountsPermissions: emptyAccounts(),
 });

 const [editForm, setEditForm] = useState({
 name: '',
 role: 'staff' as UserRole,
 staffUserType: 'operations' as StaffUserType,
 accountsPermissions: emptyAccounts(),
 isActive: true,
 newPassword: '',
 });

 useEffect(() => {
 let cancelled = false;
 setLoading(true);
 setError(null);
 fetch('/api/users')
 .then(async (r) => {
 const payload = await r.json().catch(() => ({}));
 if (r.status === 403) {
 setForbidden(true);
 throw new Error('forbidden');
 }
 if (!r.ok) {
 const msg = typeof payload?.error === 'string' ? payload.error : 'Failed to load';
 throw new Error(msg);
 }
 return payload;
 })
 .then((data) => {
 if (!cancelled) setUsers(Array.isArray(data) ? data : []);
 })
 .catch((err: unknown) => {
 if (!cancelled) {
 setError(
 err instanceof Error && err.message === 'forbidden'
 ? 'Only admins can manage staff and user roles.'
 : err instanceof Error && err.message
 ? err.message
 : 'Failed to load staff.',
 );
 }
 })
 .finally(() => {
 if (!cancelled) setLoading(false);
 });
 return () => {
 cancelled = true;
 };
 }, []);

 const handleOpenAdd = () => {
 if (forbidden) return;
 setFormError(null);
 setAddForm({
 email: '',
 name: '',
 password: '',
 role: 'staff',
 staffUserType: 'operations',
 accountsPermissions: emptyAccounts(),
 });
 setAddOpen(true);
 };

 const handleSubmitAdd = async (e: React.FormEvent) => {
 e.preventDefault();
 setFormError(null);
 const email = addForm.email.trim().toLowerCase();
 const name = addForm.name.trim();
 const password = addForm.password;
 if (!email) {
 setFormError('Email is required.');
 return;
 }
 if (!name) {
 setFormError('Name is required.');
 return;
 }
 if (!password || password.length < 6) {
 setFormError('Password must be at least 6 characters.');
 return;
 }
 setSubmitting(true);
 try {
 const body: Record<string, unknown> = {
 email,
 name,
 password,
 role: addForm.role,
 staffUserType: addForm.staffUserType,
 };
 if (addForm.role !== 'admin') {
 body.accountsPermissions = addForm.accountsPermissions;
 }
 const res = await fetch('/api/users', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 });
 const data = await res.json();
 if (!res.ok) {
 setFormError(data.error || 'Failed to create user.');
 return;
 }
 setUsers((prev) => [data, ...prev]);
 setAddOpen(false);
 } catch {
 setFormError('Failed to create user.');
 } finally {
 setSubmitting(false);
 }
 };

 const handleOpenEdit = (user: UserSummary) => {
 setFormError(null);
 setEditForm({
 name: user.name,
 role: user.role,
 staffUserType: user.staffUserType,
 accountsPermissions: { ...user.accountsPermissions },
 isActive: user.isActive,
 newPassword: '',
 });
 setEditingUser(user);
 };

 const handleSubmitEdit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!editingUser) return;
 setFormError(null);
 const name = editForm.name.trim();
 if (!name) {
 setFormError('Name is required.');
 return;
 }
 if (editForm.newPassword && editForm.newPassword.length < 6) {
 setFormError('New password must be at least 6 characters.');
 return;
 }
 setSubmitting(true);
 try {
 const body: Record<string, unknown> = {
 name,
 role: editForm.role,
 isActive: editForm.isActive,
 staffUserType: editForm.staffUserType,
 };
 if (editForm.role !== 'admin') {
 body.accountsPermissions = editForm.accountsPermissions;
 }
 if (editForm.newPassword.trim()) body.password = editForm.newPassword.trim();
 const res = await fetch(`/api/users/${editingUser.id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 });
 const data = await res.json();
 if (!res.ok) {
 setFormError(data.error || 'Failed to update user.');
 return;
 }
 setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? data : u)));
 setEditingUser(null);
 } catch {
 setFormError('Failed to update user.');
 } finally {
 setSubmitting(false);
 }
 };

 const handleDelete = async (user: UserSummary) => {
 if (!window.confirm(`Remove "${user.name}" from staff? This cannot be undone.`)) return;
 setDeletingId(user.id);
 try {
 const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
 if (!res.ok) {
 const data = await res.json();
 setError(data.error || 'Failed to delete user.');
 return;
 }
 setUsers((prev) => prev.filter((u) => u.id !== user.id));
 } catch {
 setError('Failed to delete user.');
 } finally {
 setDeletingId(null);
 }
 };

 const accountsFields = (prefix: 'add' | 'edit') => {
 const role = prefix === 'add' ? addForm.role : editForm.role;
 const perms = prefix === 'add' ? addForm.accountsPermissions : editForm.accountsPermissions;
 const setPerms =
 prefix === 'add'
 ? (next: AccountsPermissionsSummary) =>
 setAddForm((f) => ({ ...f, accountsPermissions: next }))
 : (next: AccountsPermissionsSummary) =>
 setEditForm((f) => ({ ...f, accountsPermissions: next }));

 if (role === 'admin') {
 return (
 <p className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-2">
 Admins always have full Accounts access. Scoped finance rows are cleared for admin users.
 </p>
 );
 }

 const toggle = (key: keyof AccountsPermissionsSummary) => {
 setPerms({ ...perms, [key]: !perms[key] });
 };

 return (
 <fieldset className="space-y-2 rounded-lg border border-neutral-200 p-3">
 <legend className="text-sm font-medium text-neutral-800 px-1">Accounts module (finance)</legend>
 <p className="text-xs text-neutral-500 -mt-1 mb-2">
 Toggle what this user can change in Accounts. Separation of duties: grant only what they need.
 </p>
 {(
 [
 ['canManageContracts', 'Contracts'] as const,
 ['canManageInvoices', 'Invoices'] as const,
 ['canManagePayments', 'Receipts & payments'] as const,
 ['canManageVendors', 'Vendors & bills'] as const,
 ] as const
 ).map(([key, label]) => (
 <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
 <input
 type="checkbox"
 checked={perms[key]}
 onChange={() => toggle(key)}
 className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
 />
 {label}
 </label>
 ))}
 </fieldset>
 );
 };

 const userTypeSelect = (prefix: 'add' | 'edit') => {
 const value = prefix === 'add' ? addForm.staffUserType : editForm.staffUserType;
 const onChange = (staffUserType: StaffUserType) => {
 if (prefix === 'add') setAddForm((f) => ({ ...f, staffUserType }));
 else setEditForm((f) => ({ ...f, staffUserType }));
 };

 return (
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">User type</label>
 <select
 value={value}
 onChange={(e) => onChange(e.target.value as StaffUserType)}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
 >
 {STAFF_USER_TYPES.map((t) => (
 <option key={t} value={t}>
 {STAFF_USER_TYPE_LABELS[t]}
 </option>
 ))}
 </select>
 <p className="text-xs text-neutral-500 mt-1">
 <strong>Business manager</strong> can approve staff leave. <strong>Director</strong> is reserved for a
 future read-only executive dashboard.
 </p>
 </div>
 );
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Staff"
 description="Staff accounts, roles, user types, and Accounts permissions."
 actions={
 <button
 type="button"
 onClick={handleOpenAdd}
 disabled={forbidden}
 className="btn-primary inline-flex shrink-0 items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <Plus className="h-4 w-4" />
 Add staff member
 </button>
 }
 />

 {error && (
 <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">{error}</div>
 )}

 {loading ? (
 <div className="flex items-center justify-center py-16">
 <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
 </div>
 ) : users.length === 0 ? (
 <motion.div
 className="dashboard-surface shadow-sm p-8 sm:p-12 text-center"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 >
 <UserCog className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
 <p className="text-neutral-600 text-sm sm:text-base mb-4">
 No staff members yet. Add users to manage who can access the dashboard.
 </p>
 <button
 type="button"
 onClick={handleOpenAdd}
 className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 text-sm font-medium"
 >
 <Plus className="w-4 h-4" />
 Add staff member
 </button>
 </motion.div>
 ) : (
 <motion.div
 className="dashboard-surface shadow-sm overflow-hidden"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 >
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full text-left min-w-[800px]">
 <thead>
 <tr className="dashboard-toolbar">
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
 Name
 </th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
 Email
 </th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider col-center">
 Role
 </th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider col-center">
 User type
 </th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
 Accounts
 </th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider col-center">
 Status
 </th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider col-right">
 Actions
 </th>
 </tr>
 </thead>
 <tbody>
 {users.map((u) => (
 <tr key={u.id} className="border-b border-neutral-100 hover:bg-neutral-50/50">
 <td className="px-4 py-3 text-sm font-medium text-primary-900">{u.name}</td>
 <td className="px-4 py-3 text-sm text-neutral-600">{u.email}</td>
 <td className="px-4 py-3 col-center">
 <span
 className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${ROLE_STYLES[u.role]}`}
 >
 {ROLE_LABELS[u.role]}
 </span>
 </td>
 <td className="px-4 py-3 text-xs text-neutral-700 max-w-[10rem] col-center">
 {STAFF_USER_TYPE_LABELS[u.staffUserType]}
 </td>
 <td className="px-4 py-3 text-xs text-neutral-600 max-w-[12rem]" title={accountsAccessLabel(u)}>
 {accountsAccessLabel(u)}
 </td>
 <td className="px-4 py-3 text-sm text-neutral-600 col-center">{u.isActive ? 'Active' : 'Inactive'}</td>
 <td className="px-4 py-3 col-right">
 <div className="flex items-center justify-end gap-2">
 <button
 type="button"
 onClick={() => handleOpenEdit(u)}
 className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-primary-600 transition-colors"
 title="Edit"
 >
 <Pencil className="w-4 h-4" />
 </button>
 <button
 type="button"
 onClick={() => handleDelete(u)}
 disabled={deletingId === u.id}
 className="p-2 rounded-lg text-neutral-600 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
 title="Remove"
 >
 {deletingId === u.id ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Trash2 className="w-4 h-4" />
 )}
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </motion.div>
 )}

 <AnimatePresence>
 {addOpen && (
 <motion.div
 className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={() => !submitting && setAddOpen(false)}
 >
 <motion.div
 className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
 initial={{ scale: 0.95, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0.95, opacity: 0 }}
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center justify-between p-4 border-b border-neutral-200">
 <h2 className="text-lg font-semibold text-primary-900">Add staff member</h2>
 <button
 type="button"
 onClick={() => !submitting && setAddOpen(false)}
 className="p-1 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
 aria-label="Close"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 <form onSubmit={handleSubmitAdd} className="p-4 space-y-4">
 {formError && (
 <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
 )}
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
 <input
 type="email"
 value={addForm.email}
 onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
 required
 placeholder="name@example.com"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
 <input
 type="text"
 value={addForm.name}
 onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
 required
 placeholder="Full name"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
 <input
 type="password"
 value={addForm.password}
 onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
 required
 minLength={6}
 placeholder="At least 6 characters"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Role</label>
 <select
 value={addForm.role}
 onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as UserRole }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
 >
 <option value="admin">Admin (owner / IT — full access)</option>
 <option value="staff">Staff</option>
 <option value="viewer">Viewer</option>
 </select>
 </div>
 {userTypeSelect('add')}
 {accountsFields('add')}
 <div className="flex gap-3 pt-2">
 <button
 type="button"
 onClick={() => !submitting && setAddOpen(false)}
 className="flex-1 px-4 py-2.5 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 text-sm font-medium"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={submitting}
 className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium inline-flex items-center justify-center gap-2"
 >
 {submitting ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Saving…
 </>
 ) : (
 'Add user'
 )}
 </button>
 </div>
 </form>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>

 <AnimatePresence>
 {editingUser && (
 <motion.div
 className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={() => !submitting && setEditingUser(null)}
 >
 <motion.div
 className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
 initial={{ scale: 0.95, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0.95, opacity: 0 }}
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center justify-between p-4 border-b border-neutral-200">
 <h2 className="text-lg font-semibold text-primary-900">Edit staff member</h2>
 <button
 type="button"
 onClick={() => !submitting && setEditingUser(null)}
 className="p-1 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
 aria-label="Close"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 <form onSubmit={handleSubmitEdit} className="p-4 space-y-4">
 {formError && (
 <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
 )}
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
 <p className="text-sm text-neutral-600">{editingUser.email}</p>
 <p className="text-xs text-neutral-500 mt-0.5">Email cannot be changed.</p>
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
 <input
 type="text"
 value={editForm.name}
 onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
 required
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Role</label>
 <select
 value={editForm.role}
 onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as UserRole }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
 >
 <option value="admin">Admin (owner / IT — full access)</option>
 <option value="staff">Staff</option>
 <option value="viewer">Viewer</option>
 </select>
 </div>
 {userTypeSelect('edit')}
 {accountsFields('edit')}
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="edit-isActive"
 checked={editForm.isActive}
 onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
 className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
 />
 <label htmlFor="edit-isActive" className="text-sm font-medium text-neutral-700">
 Active (can sign in)
 </label>
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">
 New password (optional)
 </label>
 <input
 type="password"
 value={editForm.newPassword}
 onChange={(e) => setEditForm((f) => ({ ...f, newPassword: e.target.value }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
 minLength={6}
 placeholder="Leave blank to keep current"
 />
 </div>
 <div className="flex gap-3 pt-2">
 <button
 type="button"
 onClick={() => !submitting && setEditingUser(null)}
 className="flex-1 px-4 py-2.5 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 text-sm font-medium"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={submitting}
 className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium inline-flex items-center justify-center gap-2"
 >
 {submitting ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Saving…
 </>
 ) : (
 'Save changes'
 )}
 </button>
 </div>
 </form>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 </DashboardPage>
 );
}
