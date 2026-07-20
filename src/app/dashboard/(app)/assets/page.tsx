'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Boxes,
  Loader2,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  assetCategoryLabel,
  assetStatusLabel,
} from '@/lib/asset-categories';
import { DEPRECIATION_METHODS } from '@/lib/asset-depreciation';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { DashboardAsyncState, DashboardInlineLoading } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableSearchInput,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardModal } from '@/components/dashboard/DashboardModal';
import { DashboardPagination } from '@/components/dashboard/DashboardPagination';
import { ExportButton } from '@/components/dashboard/ExportButton';
import { StrideSelect } from '@/components/ui/stride-select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import { apiFetch, useApiMutation, useApiResource } from '@/hooks/useApiResource';
import { useSortableTable } from '@/hooks/useSortableTable';
import { useTableSelection } from '@/hooks/useTableSelection';
import { AssetDetailDrawer } from './_components/AssetDetailDrawer';
import {
  assetStatusChipTone,
  formatCurrency,
  type AssetListResponse,
  type AssetRecord,
  type AssetSummary,
  type EmployeeOption,
} from './_components/asset-types';

const PAGE_SIZE = 25;
const LIST_KEY = ['assets', 'list'] as const;
const SUMMARY_KEY = ['assets', 'summary'] as const;
const INVALIDATE = [LIST_KEY, SUMMARY_KEY];

type ViewKey = 'all' | 'assigned' | 'handover';
type SortKey = 'assetTag' | 'name' | 'category' | 'status' | 'location' | 'purchaseCost' | 'nextMaintenanceAt';

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
  depreciationMethod: 'straight_line',
  usefulLifeMonths: '',
  salvageValue: '',
};

type FormState = typeof emptyForm;

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

  const [view, setView] = useState<ViewKey>(assignedFromUrl ? 'assigned' : 'all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const { sort, toggleSort, getSortDirection } = useSortableTable<SortKey>({
    key: 'assetTag',
    direction: 'asc',
  });

  // Modals & drawer.
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [assignAsset, setAssignAsset] = useState<AssetRecord | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [deleteAsset, setDeleteAsset] = useState<AssetRecord | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState('');

  useEffect(() => {
    setView(assignedFromUrl ? 'assigned' : 'all');
  }, [assignedFromUrl]);

  // Debounce search.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to first page whenever the query changes.
  useEffect(() => {
    setPage(1);
  }, [view, search, statusFilter, categoryFilter, sort.key, sort.direction]);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    params.set('sortKey', sort.key);
    params.set('sortDir', sort.direction);
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (search) params.set('q', search);
    if (view === 'assigned') params.set('assigned', '1');
    if (view === 'handover') params.set('handover', 'pending');
    return `/api/assets?${params.toString()}`;
  }, [page, sort.key, sort.direction, statusFilter, categoryFilter, search, view]);

  const listQuery = useApiResource<AssetListResponse>([...LIST_KEY, listUrl], listUrl, {
    placeholderData: (prev) => prev,
  });
  const summaryQuery = useApiResource<AssetSummary>(SUMMARY_KEY, '/api/assets/summary');
  const employeesQuery = useApiResource<EmployeeOption[]>(
    ['assets', 'employees'],
    '/api/outsourcing/employees',
  );

  const assets = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const total = listQuery.data?.total ?? 0;
  const employees = useMemo(
    () => (Array.isArray(employeesQuery.data) ? employeesQuery.data : []),
    [employeesQuery.data],
  );

  const visibleIds = useMemo(() => assets.map((a) => a.id), [assets]);
  const selection = useTableSelection(visibleIds);

  const detailAsset = useMemo(
    () => assets.find((a) => a.id === detailId) ?? null,
    [assets, detailId],
  );

  const summary = summaryQuery.data;

  const listStatus = listQuery.isLoading
    ? 'loading'
    : listQuery.isError && assets.length === 0
      ? 'error'
      : assets.length === 0
        ? 'empty'
        : 'success';

  // --- Mutations -----------------------------------------------------------
  const saveMutation = useApiMutation(
    (payload: { id: string | null; body: Record<string, unknown> }) =>
      apiFetch(payload.id ? `/api/assets/${payload.id}` : '/api/assets', {
        method: payload.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload.body),
      }),
    {
      invalidateKeys: INVALIDATE,
      onSuccess: () => {
        toast.success(editingId ? 'Asset updated' : 'Asset created');
        setFormOpen(false);
      },
      onError: (e) => toast.error(e.message),
    },
  );

  const patchMutation = useApiMutation(
    (payload: { id: string; body: Record<string, unknown>; success: string }) =>
      apiFetch(`/api/assets/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload.body),
      }).then((res) => {
        toast.success(payload.success);
        return res;
      }),
    { invalidateKeys: INVALIDATE, onError: (e) => toast.error(e.message) },
  );

  const deleteMutation = useApiMutation(
    (id: string) => apiFetch(`/api/assets/${id}`, { method: 'DELETE' }),
    {
      invalidateKeys: INVALIDATE,
      onSuccess: () => {
        toast.success('Asset deleted');
        setDeleteAsset(null);
      },
      onError: (e) => toast.error(e.message),
    },
  );

  const bulkMutation = useApiMutation(
    async (payload: { ids: string[]; body: Record<string, unknown> }) => {
      await Promise.all(
        payload.ids.map((id) =>
          apiFetch(`/api/assets/${id}`, { method: 'PATCH', body: JSON.stringify(payload.body) }),
        ),
      );
    },
    {
      invalidateKeys: INVALIDATE,
      onSuccess: () => {
        toast.success('Bulk update applied');
        selection.clear();
        setBulkStatus('');
      },
      onError: (e) => toast.error(e.message),
    },
  );

  // --- Handlers ------------------------------------------------------------
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
      depreciationMethod: asset.depreciationMethod ?? 'straight_line',
      usefulLifeMonths: asset.usefulLifeMonths != null ? String(asset.usefulLifeMonths) : '',
      salvageValue: asset.salvageValue != null ? String(asset.salvageValue) : '',
    });
    setFormOpen(true);
  };

  const submitForm = () => {
    if (!form.assetTag.trim()) return toast.error('Asset tag is required');
    if (!form.name.trim()) return toast.error('Name is required');
    const body: Record<string, unknown> = {
      assetTag: form.assetTag.trim(),
      name: form.name.trim(),
      category: form.category,
      status: form.status,
      serialNumber: form.serialNumber || null,
      manufacturer: form.manufacturer || null,
      model: form.model || null,
      purchaseDate: form.purchaseDate || null,
      purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : null,
      warrantyExpiry: form.warrantyExpiry || null,
      location: form.location || null,
      notes: form.notes || null,
      depreciationMethod: form.depreciationMethod,
      usefulLifeMonths: form.usefulLifeMonths ? Number(form.usefulLifeMonths) : null,
      salvageValue: form.salvageValue ? Number(form.salvageValue) : null,
    };
    if (!editingId && form.assignedEmployeeId) body.assignedEmployeeId = form.assignedEmployeeId;
    saveMutation.mutate({ id: editingId, body });
  };

  const openAssign = (asset: AssetRecord) => {
    setAssignAsset(asset);
    setAssignEmployeeId(asset.assignedEmployeeId ?? '');
    setAssignNotes(asset.handoverNotes ?? '');
  };

  const submitAssign = () => {
    if (!assignAsset || !assignEmployeeId) return;
    patchMutation.mutate(
      {
        id: assignAsset.id,
        body: { action: 'assign', employeeId: assignEmployeeId, handoverNotes: assignNotes || null },
        success: 'Asset assigned',
      },
      { onSuccess: () => setAssignAsset(null) },
    );
  };

  const employeeOptions = useMemo(
    () => [
      { value: '', label: 'Unassigned' },
      ...employees.map((emp) => ({
        value: emp.id,
        label: `${emp.firstName} ${emp.lastName}${emp.employeeNumber ? ` (${emp.employeeNumber})` : ''}`,
      })),
    ],
    [employees],
  );

  const selectedExportHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set('ids', selection.selectedIds.join(','));
    return params.toString();
  }, [selection.selectedIds]);

  const busy = patchMutation.isPending;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Asset manager"
        icon={Package}
        iconClassName="h-7 w-7 text-primary-600"
        description="Register assets, track assignments and handover, schedule maintenance, and monitor value."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              options={[
                { format: 'csv', label: 'Export CSV', href: `/api/assets/export?format=csv` },
                { format: 'xlsx', label: 'Export Excel', href: `/api/assets/export?format=xlsx` },
              ]}
            />
            <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              Add asset
            </button>
          </div>
        }
        footer={
          <DashboardTabs
            embedded
            value={view}
            onChange={(next) => setView(next as ViewKey)}
            items={[
              { value: 'all', label: 'All assets', icon: Boxes },
              { value: 'assigned', label: 'Assigned', icon: PackageCheck },
              {
                value: 'handover',
                label: 'Handover pending',
                icon: UserCheck,
                badge:
                  summary && summary.handoverPending > 0 ? (
                    <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">
                      {summary.handoverPending}
                    </span>
                  ) : undefined,
              },
            ]}
          />
        }
      />

      <DashboardStatGrid columns={6}>
        <DashboardStatCard label="Total assets" value={summary?.total ?? '—'} tone="primary" />
        <DashboardStatCard label="Assigned" value={summary?.assigned ?? '—'} tone="sky" />
        <DashboardStatCard label="Available" value={summary?.available ?? '—'} tone="success" />
        <DashboardStatCard label="In maintenance" value={summary?.maintenance ?? '—'} tone="violet" />
        <DashboardStatCard label="Warranty expiring" value={summary?.warrantyExpiring ?? '—'} tone="warning" warn />
        <DashboardStatCard label="Handover pending" value={summary?.handoverPending ?? '—'} tone="warning" warn />
      </DashboardStatGrid>

      <DashboardTableCard>
        <DashboardTableToolbar label={null}>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <DashboardTableSearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search tag, name, serial, assignee…"
              />
            </div>
            <StrideSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: '', label: 'All categories' },
                ...ASSET_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
              ]}
              ariaLabel="Category"
              className="w-full sm:w-48"
            />
            <StrideSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: '', label: 'All statuses' },
                ...ASSET_STATUSES.map((s) => ({ value: s.value, label: s.label })),
              ]}
              ariaLabel="Status"
              className="w-full sm:w-44"
            />
          </div>
        </DashboardTableToolbar>

        {selection.hasSelection ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--dash-border)] bg-primary-50/60 px-4 py-2.5 text-sm">
            <span className="font-medium text-primary-900">{selection.selectedCount} selected</span>
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1.5 py-1.5"
              disabled={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({ ids: selection.selectedIds, body: { action: 'return' } })}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Return
            </button>
            <div className="inline-flex items-center gap-1.5">
              <StrideSelect
                value={bulkStatus}
                onChange={(v) => setBulkStatus(v)}
                options={[
                  { value: '', label: 'Set status…' },
                  ...ASSET_STATUSES.map((s) => ({ value: s.value, label: s.label })),
                ]}
                ariaLabel="Bulk status"
                size="sm"
                className="w-40"
              />
              <button
                type="button"
                className="btn-secondary py-1.5"
                disabled={!bulkStatus || bulkMutation.isPending}
                onClick={() => bulkMutation.mutate({ ids: selection.selectedIds, body: { status: bulkStatus } })}
              >
                Apply
              </button>
            </div>
            <ExportButton
              options={[
                { format: 'csv', label: 'Export selected (CSV)', href: `/api/assets/export?format=csv&${selectedExportHref}` },
                { format: 'xlsx', label: 'Export selected (Excel)', href: `/api/assets/export?format=xlsx&${selectedExportHref}` },
              ]}
              label="Export selected"
            />
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
              onClick={selection.clear}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
            {bulkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-primary-600" /> : null}
          </div>
        ) : null}

        <DashboardAsyncState
          status={listStatus}
          error={listQuery.error?.message}
          onRetry={() => void listQuery.refetch()}
          loading={<DashboardInlineLoading label="Loading assets…" />}
          empty={
            <DashboardTableEmpty
              icon={<Package className="h-8 w-8 text-neutral-300" aria-hidden />}
              title={view === 'handover' ? 'No pending handovers' : 'No assets found'}
              description={
                view === 'handover'
                  ? 'All assigned assets have been acknowledged.'
                  : 'Add laptops, phones, vehicles, or equipment to start tracking assignments.'
              }
            />
          }
        >
          <DashboardTableViewport>
            <DashboardTable className="text-sm">
              <thead className="border-b border-neutral-100 bg-neutral-50/80 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      className="h-4 w-4 cursor-pointer rounded border-neutral-300"
                      checked={selection.allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = selection.someVisibleSelected;
                      }}
                      onChange={selection.toggleAllVisible}
                    />
                  </th>
                  <SortHeader label="Tag" sortKey="assetTag" active={getSortDirection('assetTag')} onSort={toggleSort} />
                  <SortHeader label="Asset" sortKey="name" active={getSortDirection('name')} onSort={toggleSort} />
                  <SortHeader label="Category" sortKey="category" active={getSortDirection('category')} onSort={toggleSort} />
                  <SortHeader label="Status" sortKey="status" active={getSortDirection('status')} onSort={toggleSort} className="col-center" />
                  <th className="px-4 py-3">Assigned to</th>
                  <SortHeader label="Book value" sortKey="purchaseCost" active={getSortDirection('purchaseCost')} onSort={toggleSort} className="col-right" />
                  <th className="col-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {assets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="cursor-pointer hover:bg-neutral-50/60"
                    onClick={() => setDetailId(asset.id)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${asset.assetTag}`}
                        className="h-4 w-4 cursor-pointer rounded border-neutral-300"
                        checked={selection.isSelected(asset.id)}
                        onChange={() => selection.toggle(asset.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700">{asset.assetTag}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{asset.name}</p>
                      {asset.serialNumber ? (
                        <p className="text-xs text-neutral-500">S/N {asset.serialNumber}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{assetCategoryLabel(asset.category)}</td>
                    <td className="col-center px-4 py-3">
                      <span className={dashStatusChip(assetStatusChipTone(asset.status))}>
                        {assetStatusLabel(asset.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {asset.assignedEmployeeName ? (
                        <>
                          <p>{asset.assignedEmployeeName}</p>
                          {asset.needsHandoverAck ? (
                            <p className="text-xs font-medium text-amber-700">Handover pending</p>
                          ) : asset.handoverAcknowledgedAt ? (
                            <p className="text-xs text-emerald-700">Acknowledged</p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="col-right px-4 py-3 tabular-nums text-neutral-700">
                      {asset.bookValue != null ? formatCurrency(asset.bookValue) : '—'}
                    </td>
                    <td className="col-right px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`/api/assets/${asset.id}/label`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Print QR label"
                          className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-ink"
                        >
                          <QrCode className="h-4 w-4" />
                        </a>
                        {asset.status === 'assigned' && asset.needsHandoverAck ? (
                          <button
                            type="button"
                            title="Acknowledge handover"
                            disabled={busy}
                            onClick={() =>
                              patchMutation.mutate({
                                id: asset.id,
                                body: { action: 'acknowledge' },
                                success: 'Handover acknowledged',
                              })
                            }
                            className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-ink"
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                        ) : null}
                        {asset.status === 'assigned' ? (
                          <button
                            type="button"
                            title="Return asset"
                            disabled={busy}
                            onClick={() =>
                              patchMutation.mutate({
                                id: asset.id,
                                body: { action: 'return' },
                                success: 'Asset returned',
                              })
                            }
                            className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-ink"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Assign to employee"
                            onClick={() => openAssign(asset)}
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
                          onClick={() => setDeleteAsset(asset)}
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

        {total > 0 ? (
          <DashboardPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            itemLabel="assets"
          />
        ) : null}
      </DashboardTableCard>

      {/* Add / edit modal */}
      <DashboardModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Edit asset' : 'Add asset'}
        icon={<Package className="h-5 w-5" />}
        size="lg"
        dismissible={!saveMutation.isPending}
        footer={
          <>
            <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitForm}
              disabled={saveMutation.isPending}
              className="btn-primary inline-flex items-center gap-2"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Asset tag *" value={form.assetTag} onChange={(v) => setForm((f) => ({ ...f, assetTag: v }))} placeholder="AST-001" />
          <TextField label="Name *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <SelectField label="Category" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={ASSET_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
          <SelectField label="Status" value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={ASSET_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
          <TextField className="sm:col-span-2" label="Serial number" value={form.serialNumber} onChange={(v) => setForm((f) => ({ ...f, serialNumber: v }))} />
          <TextField label="Manufacturer" value={form.manufacturer} onChange={(v) => setForm((f) => ({ ...f, manufacturer: v }))} />
          <TextField label="Model" value={form.model} onChange={(v) => setForm((f) => ({ ...f, model: v }))} />
          <TextField label="Purchase date" type="date" value={form.purchaseDate} onChange={(v) => setForm((f) => ({ ...f, purchaseDate: v }))} />
          <TextField label="Warranty expiry" type="date" value={form.warrantyExpiry} onChange={(v) => setForm((f) => ({ ...f, warrantyExpiry: v }))} />
          <TextField label="Location" value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))} />
          <TextField label="Purchase cost (KES)" type="number" value={form.purchaseCost} onChange={(v) => setForm((f) => ({ ...f, purchaseCost: v }))} />
          <SelectField label="Depreciation method" value={form.depreciationMethod} onChange={(v) => setForm((f) => ({ ...f, depreciationMethod: v }))} options={DEPRECIATION_METHODS.map((m) => ({ value: m.value, label: m.label }))} />
          <TextField label="Useful life (months)" type="number" value={form.usefulLifeMonths} onChange={(v) => setForm((f) => ({ ...f, usefulLifeMonths: v }))} />
          <TextField label="Salvage value (KES)" type="number" value={form.salvageValue} onChange={(v) => setForm((f) => ({ ...f, salvageValue: v }))} />
          {!editingId ? (
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-neutral-600">Assign to employee (optional)</span>
              <StrideSelect
                value={form.assignedEmployeeId}
                onChange={(v) => setForm((f) => ({ ...f, assignedEmployeeId: v }))}
                options={employeeOptions}
                ariaLabel="Assign to employee"
                className="mt-1 w-full"
              />
            </label>
          ) : null}
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-neutral-600">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </DashboardModal>

      {/* Assign / handover modal */}
      <DashboardModal
        open={assignAsset !== null}
        onClose={() => setAssignAsset(null)}
        title="Assign asset"
        description={assignAsset ? `${assignAsset.assetTag} · ${assignAsset.name}` : undefined}
        icon={<UserPlus className="h-5 w-5" />}
        dismissible={!patchMutation.isPending}
        footer={
          <>
            <button type="button" onClick={() => setAssignAsset(null)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitAssign}
              disabled={!assignEmployeeId || patchMutation.isPending}
              className="btn-primary inline-flex items-center gap-2"
            >
              {patchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Assign
            </button>
          </>
        }
      >
        <label className="block">
          <span className="text-xs font-medium text-neutral-600">Employee</span>
          <StrideSelect
            value={assignEmployeeId}
            onChange={setAssignEmployeeId}
            options={[{ value: '', label: 'Select employee…' }, ...employeeOptions.slice(1)]}
            ariaLabel="Employee"
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-medium text-neutral-600">Handover notes</span>
          <textarea
            value={assignNotes}
            onChange={(e) => setAssignNotes(e.target.value)}
            rows={3}
            placeholder="Condition, accessories included, expectations…"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <p className="mt-3 text-xs text-neutral-500">
          The employee will show as <span className="font-medium text-amber-700">handover pending</span> until acknowledged.
        </p>
      </DashboardModal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteAsset !== null}
        title="Delete asset record?"
        description={
          deleteAsset ? `${deleteAsset.assetTag} · ${deleteAsset.name} will be permanently removed.` : undefined
        }
        tone="danger"
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteAsset(null)}
        onConfirm={() => deleteAsset && deleteMutation.mutate(deleteAsset.id)}
      />

      {/* Detail drawer */}
      <AssetDetailDrawer
        asset={detailAsset}
        open={detailId !== null && detailAsset !== null}
        onClose={() => setDetailId(null)}
        onAssign={openAssign}
        onEdit={openEdit}
        busy={busy}
        onReturn={(asset) =>
          patchMutation.mutate({ id: asset.id, body: { action: 'return' }, success: 'Asset returned' })
        }
        onAcknowledge={(asset) =>
          patchMutation.mutate({ id: asset.id, body: { action: 'acknowledge' }, success: 'Handover acknowledged' })
        }
      />
    </DashboardPage>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  active: 'asc' | 'desc' | null;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <th className={`px-4 py-3 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-ink"
      >
        {label}
        {active === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : active === 'desc' ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <input
        type={type}
        min={type === 'number' ? '0' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <StrideSelect value={value} onChange={onChange} options={options} ariaLabel={label} className="mt-1 w-full" />
    </label>
  );
}
