'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Save } from 'lucide-react';
import type { PermissionMatrixRow } from '@/types/dashboard';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export default function RolesAndPermissionsPage() {
 const [rows, setRows] = useState<PermissionMatrixRow[]>([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);

 useEffect(() => {
 let cancelled = false;
 setLoading(true);
 fetch('/api/admin/roles-permissions')
 .then(async (r) => {
 const data = await r.json();
 if (!r.ok) throw new Error(data.error || 'Failed to load permissions.');
 return data;
 })
 .then((data) => {
 if (!cancelled) setRows(Array.isArray(data) ? data : []);
 })
 .catch((e: unknown) => {
 if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load permissions.');
 })
 .finally(() => {
 if (!cancelled) setLoading(false);
 });
 return () => {
 cancelled = true;
 };
 }, []);

 async function save() {
 setSaving(true);
 setError(null);
 setSuccess(null);
 try {
 const res = await fetch('/api/admin/roles-permissions', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(rows),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to save permissions.');
 setSuccess('Role permissions saved.');
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to save permissions.');
 } finally {
 setSaving(false);
 }
 }

 function toggle(idx: number, key: 'adminAllowed' | 'staffAllowed' | 'viewerAllowed') {
 setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [key]: !row[key] } : row)));
 }

 return (
 <DashboardPage>
 <DashboardPageHeader
 icon={KeyRound}
 title="Roles & permissions"
 description="Default access by role for platform modules."
 actions={
 <button
 type="button"
 disabled={saving || loading}
 onClick={save}
 className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
 >
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
 Save changes
 </button>
 }
 />

 {error && <p className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-100">{error}</p>}
 {success && <p className="mb-4 rounded-lg bg-emerald-50 text-emerald-700 text-sm px-3 py-2 border border-emerald-100">{success}</p>}

 <div className="dashboard-surface shadow-sm">
 {loading ? (
 <div className="py-16 flex items-center justify-center">
 <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full text-left min-w-[900px]">
 <thead className="bg-neutral-50 border-b border-neutral-200">
 <tr>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Permission</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Module</th>
 <th className="col-center px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Admin</th>
 <th className="col-center px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Staff</th>
 <th className="col-center px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Viewer</th>
 </tr>
 </thead>
 <tbody>
 {rows.map((row, idx) => (
 <tr key={row.permissionKey} className="border-b border-neutral-100">
 <td className="px-4 py-3">
 <p className="text-sm font-medium text-primary-900">{row.label}</p>
 <p className="text-xs text-neutral-500">{row.description || row.permissionKey}</p>
 </td>
 <td className="px-4 py-3 text-sm text-neutral-700">{row.module}</td>
 <td className="col-center px-4 py-3 text-sm">
 <input type="checkbox" checked={row.adminAllowed} onChange={() => toggle(idx, 'adminAllowed')} />
 </td>
 <td className="col-center px-4 py-3 text-sm">
 <input type="checkbox" checked={row.staffAllowed} onChange={() => toggle(idx, 'staffAllowed')} />
 </td>
 <td className="col-center px-4 py-3 text-sm">
 <input type="checkbox" checked={row.viewerAllowed} onChange={() => toggle(idx, 'viewerAllowed')} />
 </td>
 </tr>
 ))}
 {!rows.length && (
 <tr>
 <td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-500">
 No permissions found.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </DashboardPage>
 );
}
