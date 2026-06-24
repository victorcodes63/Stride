'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
 ASSET_CATEGORIES,
 ASSET_STATUSES,
 assetCategoryLabel,
 assetStatusLabel,
} from '@/lib/asset-categories';
import { DashboardAsyncState, DashboardInlineLoading } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableSearchInput,
  DashboardTableToolbar,
  DashboardTableViewport,
  dashboardTableSelectClass,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import {
  Loader2,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
} from 'lucide-react';

type AssetRecord = {
 id: string;
 assetTag: string;
 name: string;
 description: string | null;
 category: string;
 status: string;
 serialNumber: string | null;
 manufacturer: string | null;
 model: string | null;
 purchaseDate: string | null;
 purchaseCost: number | null;
 warrantyExpiry: string | null;
 location: string | null;
 notes: string | null;
 assignedEmployeeId: string | null;
 assignedEmployeeName: string | null;
 assignedEmployeeNumber: string | null;
};

type EmployeeOption = {
 id: string;
 firstName: string;
 lastName: string;
 employeeNumber: string | null;
};

const emptyForm = {
 assetTag: '',
 name: '',
 category: 'it_equipment',
 status: 'available',
 serialNumber: '',
 manufacturer: '',
 model: '',
 purchaseDate: '',
 purchaseCost: '',
 warrantyExpiry: '',
 location: '',
 notes: '',
 assignedEmployeeId: '',
};

function statusBadgeClass(status: string) {
 switch (status) {
 case 'available':
 return 'bg-emerald-50 text-emerald-800 border-emerald-200';
 case 'assigned':
 return 'bg-sky-50 text-sky-800 border-sky-200';
 case 'maintenance':
 return 'bg-primary-50 text-primary-800 border-primary-200';
 case 'retired':
 return 'bg-neutral-100 text-neutral-600 border-neutral-200';
 case 'lost':
 return 'bg-red-50 text-red-800 border-red-200';
 default:
 return 'bg-neutral-50 text-neutral-700 border-neutral-200';
 }
}

export default function AssetsPage() {
 return (
 <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500">Loading assets…</div>}>
 <AssetsPageContent />
 </Suspense>
 );
}

function AssetsPageContent() {
 const searchParams = useSearchParams();
 const assignedFromUrl = searchParams.get('assigned') === '1';
 const [assets, setAssets] = useState<AssetRecord[]>([]);
 const [employees, setEmployees] = useState<EmployeeOption[]>([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState('');
 const [categoryFilter, setCategoryFilter] = useState('');
 const [view, setView] = useState<'all' | 'assigned'>(assignedFromUrl ? 'assigned' : 'all');
 const [formOpen, setFormOpen] = useState(false);
 const [assignOpen, setAssignOpen] = useState<string | null>(null);
 const [assignEmployeeId, setAssignEmployeeId] = useState('');
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form, setForm] = useState(emptyForm);

 useEffect(() => {
 setView(assignedFromUrl ? 'assigned' : 'all');
 }, [assignedFromUrl]);

 const load = useCallback(async () => {
 setLoading(true);
 setError(null);
 try {
 const params = new URLSearchParams();
 if (statusFilter) params.set('status', statusFilter);
 if (categoryFilter) params.set('category', categoryFilter);
 if (view === 'assigned') params.set('assigned', '1');
 const q = search.trim();
 if (q) params.set('q', q);

 const [assetsRes, employeesRes] = await Promise.all([
 fetch(`/api/assets?${params.toString()}`),
 fetch('/api/outsourcing/employees'),
 ]);
 const assetsData = await assetsRes.json().catch(() => []);
 const employeesData = await employeesRes.json().catch(() => []);
 if (!assetsRes.ok) throw new Error(assetsData.error || 'Failed to load assets');
 setAssets(Array.isArray(assetsData) ? assetsData : []);
 setEmployees(Array.isArray(employeesData) ? employeesData : []);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to load assets');
 } finally {
 setLoading(false);
 }
 }, [categoryFilter, search, statusFilter, view]);

 useEffect(() => {
 void load();
 }, [load]);

 const stats = useMemo(() => {
 const total = assets.length;
 const assigned = assets.filter((a) => a.status === 'assigned').length;
 const available = assets.filter((a) => a.status === 'available').length;
 const maintenance = assets.filter((a) => a.status === 'maintenance').length;
 return { total, assigned, available, maintenance };
 }, [assets]);

 const listStatus = useMemo(() => {
 if (loading) return 'loading' as const;
 if (error && assets.length === 0) return 'error' as const;
 if (assets.length === 0) return 'empty' as const;
 return 'success' as const;
 }, [assets.length, error, loading]);

 const openCreate = () => {
 setEditingId(null);
 setForm(emptyForm);
 setFormOpen(true);
 };

 const openEdit = (asset: AssetRecord) => {
 setEditingId(asset.id);
 setForm({
 assetTag: asset.assetTag,
 name: asset.name,
 category: asset.category,
 status: asset.status,
 serialNumber: asset.serialNumber ?? '',
 manufacturer: asset.manufacturer ?? '',
 model: asset.model ?? '',
 purchaseDate: asset.purchaseDate ?? '',
 purchaseCost: asset.purchaseCost != null ? String(asset.purchaseCost) : '',
 warrantyExpiry: asset.warrantyExpiry ?? '',
 location: asset.location ?? '',
 notes: asset.notes ?? '',
 assignedEmployeeId: asset.assignedEmployeeId ?? '',
 });
 setFormOpen(true);
 };

 const saveAsset = async () => {
 setSaving(true);
 setError(null);
 try {
 const payload = {
 ...form,
 purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : null,
 assignedEmployeeId: form.assignedEmployeeId || null,
 };
 const res = await fetch(editingId ? `/api/assets/${editingId}` : '/api/assets', {
 method: editingId ? 'PATCH' : 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to save asset');
 setFormOpen(false);
 await load();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to save asset');
 } finally {
 setSaving(false);
 }
 };

 const assignAsset = async (assetId: string) => {
 if (!assignEmployeeId) return;
 setSaving(true);
 setError(null);
 try {
 const res = await fetch(`/api/assets/${assetId}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'assign', employeeId: assignEmployeeId }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to assign asset');
 setAssignOpen(null);
 setAssignEmployeeId('');
 await load();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to assign asset');
 } finally {
 setSaving(false);
 }
 };

 const returnAsset = async (assetId: string) => {
 setSaving(true);
 setError(null);
 try {
 const res = await fetch(`/api/assets/${assetId}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'return' }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to return asset');
 await load();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to return asset');
 } finally {
 setSaving(false);
 }
 };

 const deleteAsset = async (assetId: string) => {
 if (!window.confirm('Delete this asset record? This cannot be undone.')) return;
 setSaving(true);
 setError(null);
 try {
 const res = await fetch(`/api/assets/${assetId}`, { method: 'DELETE' });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to delete asset');
 await load();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to delete asset');
 } finally {
 setSaving(false);
 }
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Asset manager"
 icon={Package}
 iconClassName="h-7 w-7 text-primary-600"
 description="Register assets, track assignments, and monitor availability."
 actions={
 <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2 shrink-0">
 <Plus className="h-4 w-4" />
 Add asset
 </button>
 }
 footer={
 <DashboardTabs
 embedded
 value={view}
 onChange={(next) => setView(next as 'all' | 'assigned')}
 items={[
 { value: 'all', label: 'All assets' },
 { value: 'assigned', label: 'Assigned only' },
 ]}
 />
 }
 />

 <DashboardStatGrid>
 <DashboardStatCard label="Total assets" value={stats.total} tone="primary" />
 <DashboardStatCard label="Assigned" value={stats.assigned} tone="sky" />
 <DashboardStatCard label="Available" value={stats.available} tone="success" />
 <DashboardStatCard label="In maintenance" value={stats.maintenance} tone="primary" />
 </DashboardStatGrid>

 {error ? (
 <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
 ) : null}

 <DashboardTableCard>
 <DashboardTableToolbar label={null}>
 <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
 <div className="relative min-w-[220px] flex-1">
 <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
 <DashboardTableSearchInput
 value={search}
 onChange={setSearch}
 placeholder="Search tag, name, serial…"
 />
 </div>
 <select
 value={categoryFilter}
 onChange={(e) => setCategoryFilter(e.target.value)}
 className={dashboardTableSelectClass}
 >
 <option value="">All categories</option>
 {ASSET_CATEGORIES.map((c) => (
 <option key={c.value} value={c.value}>
 {c.label}
 </option>
 ))}
 </select>
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className={dashboardTableSelectClass}
 >
 <option value="">All statuses</option>
 {ASSET_STATUSES.map((s) => (
 <option key={s.value} value={s.value}>
 {s.label}
 </option>
 ))}
 </select>
 </div>
 </DashboardTableToolbar>

 <DashboardAsyncState
 status={listStatus}
 error={assets.length === 0 ? error : null}
 onRetry={() => void load()}
 loading={<DashboardInlineLoading label="Loading assets…" />}
 empty={
 <DashboardTableEmpty
 icon={<Package className="h-8 w-8 text-neutral-300" aria-hidden />}
 title="No assets yet"
 description="Add laptops, phones, vehicles, or equipment to start tracking assignments."
 />
 }
 >
 <DashboardTableViewport>
 <DashboardTable className="text-sm">
 <thead className="border-b border-neutral-100 bg-neutral-50/80 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
 <tr>
 <th className="px-4 py-3">Tag</th>
 <th className="px-4 py-3">Asset</th>
 <th className="px-4 py-3">Category</th>
 <th className="col-center px-4 py-3">Status</th>
 <th className="px-4 py-3">Assigned to</th>
 <th className="px-4 py-3">Location</th>
 <th className="col-right px-4 py-3">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-neutral-100">
 {assets.map((asset) => (
 <tr key={asset.id} className="hover:bg-neutral-50/60">
 <td className="px-4 py-3 font-mono text-xs text-neutral-700">{asset.assetTag}</td>
 <td className="px-4 py-3">
 <p className="font-medium text-ink">{asset.name}</p>
 {asset.serialNumber ? (
 <p className="text-xs text-neutral-500">S/N {asset.serialNumber}</p>
 ) : null}
 </td>
 <td className="px-4 py-3 text-neutral-600">{assetCategoryLabel(asset.category)}</td>
 <td className="col-center px-4 py-3">
 <span
 className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(asset.status)}`}
 >
 {assetStatusLabel(asset.status)}
 </span>
 </td>
 <td className="px-4 py-3 text-neutral-600">
 {asset.assignedEmployeeName ? (
 <>
 <p>{asset.assignedEmployeeName}</p>
 {asset.assignedEmployeeNumber ? (
 <p className="text-xs text-neutral-500">{asset.assignedEmployeeNumber}</p>
 ) : null}
 </>
 ) : (
 <span className="text-neutral-400">—</span>
 )}
 </td>
 <td className="px-4 py-3 text-neutral-600">{asset.location || '—'}</td>
 <td className="col-right px-4 py-3">
 <div className="flex items-center justify-end gap-1">
 {asset.status === 'assigned' ? (
 <button
 type="button"
 title="Return asset"
 onClick={() => void returnAsset(asset.id)}
 className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-ink"
 >
 <RotateCcw className="h-4 w-4" />
 </button>
 ) : (
 <button
 type="button"
 title="Assign to employee"
 onClick={() => {
 setAssignOpen(asset.id);
 setAssignEmployeeId('');
 }}
 className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-ink"
 >
 <UserPlus className="h-4 w-4" />
 </button>
 )}
 <button
 type="button"
 title="Edit"
 onClick={() => openEdit(asset)}
 className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-ink"
 >
 <Pencil className="h-4 w-4" />
 </button>
 <button
 type="button"
 title="Delete"
 onClick={() => void deleteAsset(asset.id)}
 className="rounded-md p-2 text-neutral-500 hover:bg-red-50 hover:text-red-600"
 >
 <Trash2 className="h-4 w-4" />
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </DashboardTable>
 </DashboardTableViewport>
 </DashboardAsyncState>
 </DashboardTableCard>

 {formOpen ? (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
 <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
 <h2 className="text-lg font-semibold text-ink">{editingId ? 'Edit asset' : 'Add asset'}</h2>
 <div className="mt-4 grid gap-3 sm:grid-cols-2">
 <label className="block sm:col-span-1">
 <span className="text-xs font-medium text-neutral-600">Asset tag *</span>
 <input
 value={form.assetTag}
 onChange={(e) => setForm((f) => ({ ...f, assetTag: e.target.value }))}
 className="mt-1 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm"
 placeholder="AST-001"
 />
 </label>
 <label className="block sm:col-span-1">
 <span className="text-xs font-medium text-neutral-600">Name *</span>
 <input
 value={form.name}
 onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
 className="mt-1 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm"
 />
 </label>
 <label className="block">
 <span className="text-xs font-medium text-neutral-600">Category</span>
 <select
 value={form.category}
 onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
 className="mt-1 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm"
 >
 {ASSET_CATEGORIES.map((c) => (
 <option key={c.value} value={c.value}>
 {c.label}
 </option>
 ))}
 </select>
 </label>
 <label className="block">
 <span className="text-xs font-medium text-neutral-600">Status</span>
 <select
 value={form.status}
 onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
 className="mt-1 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm"
 >
 {ASSET_STATUSES.map((s) => (
 <option key={s.value} value={s.value}>
 {s.label}
 </option>
 ))}
 </select>
 </label>
 <label className="block sm:col-span-2">
 <span className="text-xs font-medium text-neutral-600">Serial number</span>
 <input
 value={form.serialNumber}
 onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
 className="mt-1 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm"
 />
 </label>
 <label className="block">
 <span className="text-xs font-medium text-neutral-600">Location</span>
 <input
 value={form.location}
 onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
 className="mt-1 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm"
 />
 </label>
 <label className="block">
 <span className="text-xs font-medium text-neutral-600">Purchase cost (KES)</span>
 <input
 type="number"
 min="0"
 value={form.purchaseCost}
 onChange={(e) => setForm((f) => ({ ...f, purchaseCost: e.target.value }))}
 className="mt-1 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm"
 />
 </label>
 {!editingId ? (
 <label className="block sm:col-span-2">
 <span className="text-xs font-medium text-neutral-600">Assign to employee (optional)</span>
 <select
 value={form.assignedEmployeeId}
 onChange={(e) => setForm((f) => ({ ...f, assignedEmployeeId: e.target.value }))}
 className="mt-1 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm"
 >
 <option value="">Unassigned</option>
 {employees.map((emp) => (
 <option key={emp.id} value={emp.id}>
 {emp.firstName} {emp.lastName}
 {emp.employeeNumber ? ` (${emp.employeeNumber})` : ''}
 </option>
 ))}
 </select>
 </label>
 ) : null}
 <label className="block sm:col-span-2">
 <span className="text-xs font-medium text-neutral-600">Notes</span>
 <textarea
 value={form.notes}
 onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
 rows={3}
 className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
 />
 </label>
 </div>
 <div className="mt-6 flex justify-end gap-2">
 <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary">
 Cancel
 </button>
 <button type="button" onClick={() => void saveAsset()} disabled={saving} className="btn-primary inline-flex items-center gap-2">
 {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
 Save
 </button>
 </div>
 </div>
 </div>
 ) : null}

 {assignOpen ? (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
 <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
 <h2 className="text-lg font-semibold text-ink">Assign asset</h2>
 <label className="mt-4 block">
 <span className="text-xs font-medium text-neutral-600">Employee</span>
 <select
 value={assignEmployeeId}
 onChange={(e) => setAssignEmployeeId(e.target.value)}
 className="mt-1 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm"
 >
 <option value="">Select employee…</option>
 {employees.map((emp) => (
 <option key={emp.id} value={emp.id}>
 {emp.firstName} {emp.lastName}
 {emp.employeeNumber ? ` (${emp.employeeNumber})` : ''}
 </option>
 ))}
 </select>
 </label>
 <div className="mt-6 flex justify-end gap-2">
 <button type="button" onClick={() => setAssignOpen(null)} className="btn-secondary">
 Cancel
 </button>
 <button
 type="button"
 disabled={!assignEmployeeId || saving}
 onClick={() => void assignAsset(assignOpen)}
 className="btn-primary inline-flex items-center gap-2"
 >
 {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
 Assign
 </button>
 </div>
 </div>
 </div>
 ) : null}
 </DashboardPage>
 );
}
