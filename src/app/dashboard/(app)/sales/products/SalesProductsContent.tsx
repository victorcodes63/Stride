'use client';

import { useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Loader2,
  Package,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Repeat,
  Trash2,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';
import {
  SalesDrawer,
  SalesEmptyState,
  SalesFilterBar,
  type FilterSelect,
} from '@/components/dashboard/sales';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { apiFetch, salesKeys, useSalesMutation, useSalesResource } from '@/lib/sales/hooks';
import { formatSalesCurrency } from '@/lib/sales/format';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  unitPrice: number;
  currency: string;
  isRecurring: boolean;
  defaultTermMonths: number | null;
  active: boolean;
  usageCount?: number;
  createdAt: string;
  updatedAt: string;
};

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="dashboard-stat-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--dash-text-muted)]">
          {label}
        </p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--stride-coral)]/10 text-[var(--stride-coral)]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-[var(--dash-text-strong)]">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[var(--dash-text-muted)]">{hint}</p> : null}
    </div>
  );
}

export default function SalesProductsContent() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [formState, setFormState] = useState<
    { mode: 'create' } | { mode: 'edit'; product: Product } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const productsQuery = useSalesResource<{ products: Product[] }>(
    salesKeys.products(),
    '/api/sales/products',
  );
  const products = useMemo(() => productsQuery.data?.products ?? [], [productsQuery.data]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.category) set.add(p.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter && (p.category ?? '') !== categoryFilter) return false;
      if (activeFilter === 'active' && !p.active) return false;
      if (activeFilter === 'inactive' && p.active) return false;
      if (q) {
        const hay = `${p.name} ${p.sku ?? ''} ${p.category ?? ''} ${p.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, search, categoryFilter, activeFilter]);

  const kpis = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.active).length;
    const recurring = products.filter((p) => p.isRecurring).length;
    return { total, active, recurring };
  }, [products]);

  const toggleMutation = useSalesMutation<unknown, { id: string; active: boolean }>(
    ({ id, active }) =>
      apiFetch(`/api/sales/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    {
      onSuccess: (_d, { active }) =>
        toast.success(active ? 'Product activated.' : 'Product deactivated.'),
    },
  );

  const deleteMutation = useSalesMutation<
    { softDeactivated?: boolean; message?: string },
    string
  >((id) => apiFetch(`/api/sales/products/${id}`, { method: 'DELETE' }), {
    onSuccess: (data) =>
      toast.success(
        data?.softDeactivated
          ? 'Product is in use — deactivated instead of deleted.'
          : 'Product deleted.',
      ),
  });

  async function toggleActive(product: Product) {
    try {
      await toggleMutation.mutateAsync({ id: product.id, active: !product.active });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed.');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  const filterSelects: FilterSelect[] = [
    {
      id: 'category',
      value: categoryFilter,
      ariaLabel: 'Filter by category',
      onChange: setCategoryFilter,
      options: [
        { value: '', label: 'All categories' },
        ...categories.map((c) => ({ value: c, label: c })),
      ],
    },
    {
      id: 'active',
      value: activeFilter,
      ariaLabel: 'Filter by status',
      onChange: setActiveFilter,
      options: [
        { value: '', label: 'All statuses' },
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
  ];

  const isLoading = productsQuery.isLoading;
  const isError = productsQuery.isError;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Price book"
        description="Maintain the catalog of products and services your team quotes and sells."
        icon={Boxes}
        actions={
          <button
            type="button"
            onClick={() => setFormState({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Add product
          </button>
        }
      />

      {isError ? (
        <SalesEmptyState
          icon={Package}
          title="Couldn't load the price book"
          description={productsQuery.error?.message ?? 'Something went wrong. Please try again.'}
          action={
            <button
              type="button"
              onClick={() => void productsQuery.refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          }
        />
      ) : isLoading ? (
        <ProductsSkeleton />
      ) : products.length === 0 ? (
        <SalesEmptyState
          icon={Boxes}
          title="No products yet"
          description="Add the products and services you sell so your team can drop them into quotes with consistent pricing."
          action={
            <button
              type="button"
              onClick={() => setFormState({ mode: 'create' })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Add product
            </button>
          }
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard icon={Boxes} label="Total products" value={String(kpis.total)} />
            <KpiCard
              icon={CheckCircle2}
              label="Active"
              value={String(kpis.active)}
              hint={kpis.total ? `${Math.round((kpis.active / kpis.total) * 100)}% of catalog` : undefined}
            />
            <KpiCard icon={Repeat} label="Recurring" value={String(kpis.recurring)} hint="Subscription items" />
          </div>

          <SalesFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name, SKU, or category…"
            selects={filterSelects}
            resultCount={filtered.length}
          />

          {filtered.length === 0 ? (
            <SalesEmptyState
              icon={Package}
              title="No matching products"
              description="Try clearing a filter or adjusting your search."
              compact
            />
          ) : (
            <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Unit price</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((product) => (
                      <tr
                        key={product.id}
                        className="border-t border-[var(--dash-border)] hover:bg-[var(--dash-hover)]"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--dash-text-strong)]">
                            {product.name}
                          </div>
                          {product.description ? (
                            <div className="max-w-xs truncate text-xs text-[var(--dash-text-muted)]">
                              {product.description}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-[var(--dash-text-muted)]">
                          {product.sku ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--dash-text-muted)]">
                          {product.category ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[var(--dash-text-strong)]">
                          {formatSalesCurrency(product.unitPrice, product.currency)}
                        </td>
                        <td className="px-4 py-3">
                          {product.isRecurring ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/20">
                              <Repeat className="h-3 w-3" />
                              {product.defaultTermMonths ? `${product.defaultTermMonths} mo` : 'Recurring'}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--dash-text-muted)]">One-off</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {product.active ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/20">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setFormState({ mode: 'edit', product })}
                              aria-label="Edit product"
                              className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text-strong)]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={toggleMutation.isPending}
                              onClick={() => void toggleActive(product)}
                              aria-label={product.active ? 'Deactivate product' : 'Activate product'}
                              title={product.active ? 'Deactivate' : 'Activate'}
                              className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text-strong)] disabled:opacity-60"
                            >
                              <Power className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(product)}
                              aria-label="Delete product"
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {formState ? (
        <ProductFormDrawer
          key={formState.mode === 'edit' ? formState.product.id : 'create'}
          mode={formState.mode}
          product={formState.mode === 'edit' ? formState.product : null}
          onClose={() => setFormState(null)}
          onSaved={() => setFormState(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete product?"
        description={
          deleteTarget
            ? deleteTarget.usageCount && deleteTarget.usageCount > 0
              ? `“${deleteTarget.name}” is referenced by existing quotes or deals, so it will be deactivated (kept for history) rather than deleted.`
              : `“${deleteTarget.name}” will be permanently removed from the price book.`
            : undefined
        }
        confirmLabel={
          deleteTarget?.usageCount && deleteTarget.usageCount > 0 ? 'Deactivate' : 'Delete'
        }
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </DashboardPage>
  );
}

function ProductFormDrawer({
  mode,
  product,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [unitPrice, setUnitPrice] = useState(
    product?.unitPrice != null ? String(product.unitPrice) : '',
  );
  const [currency, setCurrency] = useState(product?.currency ?? 'KES');
  const [isRecurring, setIsRecurring] = useState(product?.isRecurring ?? false);
  const [defaultTermMonths, setDefaultTermMonths] = useState(
    product?.defaultTermMonths != null ? String(product.defaultTermMonths) : '',
  );
  const [active, setActive] = useState(product?.active ?? true);

  const saveMutation = useSalesMutation<unknown, void>(
    () => {
      const payload = {
        name: name.trim(),
        sku: sku.trim() || null,
        category: category.trim() || null,
        description: description.trim() || null,
        unitPrice: unitPrice.trim() === '' ? 0 : Number(unitPrice),
        currency: currency.trim() || 'KES',
        isRecurring,
        defaultTermMonths:
          isRecurring && defaultTermMonths.trim() !== '' ? Number(defaultTermMonths) : null,
        active,
      };
      if (mode === 'edit' && product) {
        return apiFetch(`/api/sales/products/${product.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return apiFetch('/api/sales/products', { method: 'POST', body: JSON.stringify(payload) });
    },
    { onSuccess: () => toast.success(mode === 'edit' ? 'Product updated.' : 'Product created.') },
  );

  const canSave = name.trim().length > 0 && !saveMutation.isPending;

  async function submit() {
    if (!canSave) return;
    try {
      await saveMutation.mutateAsync();
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed.');
    }
  }

  return (
    <SalesDrawer
      open
      onClose={onClose}
      title={mode === 'edit' ? 'Edit product' : 'New product'}
      subtitle={mode === 'edit' ? product?.name : 'Add an item to the price book'}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void submit()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === 'edit' ? 'Save changes' : 'Create product'}
          </button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormField label="Name" required>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="dash-auth-input w-full"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="SKU">
            <input value={sku} onChange={(e) => setSku(e.target.value)} className="dash-auth-input w-full" />
          </FormField>
          <FormField label="Category">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Logistics"
              className="dash-auth-input w-full"
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Unit price">
            <input
              type="number"
              min={0}
              step="any"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="0"
              className="dash-auth-input w-full"
            />
          </FormField>
          <FormField label="Currency">
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className="dash-auth-input w-full uppercase"
            />
          </FormField>
        </div>
        <FormField label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="dash-auth-input w-full"
          />
        </FormField>

        <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-4">
          <label className="flex items-center gap-2 text-sm text-[var(--dash-text-strong)]">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--stride-coral)] focus:ring-[var(--stride-coral)]/30"
            />
            <Repeat className="h-4 w-4 text-[var(--dash-text-muted)]" />
            Recurring / subscription item
          </label>
          {isRecurring ? (
            <div className="mt-3">
              <FormField label="Default term (months)">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={defaultTermMonths}
                  onChange={(e) => setDefaultTermMonths(e.target.value)}
                  placeholder="e.g. 12"
                  className="dash-auth-input w-full"
                />
              </FormField>
            </div>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--dash-text-strong)]">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--stride-coral)] focus:ring-[var(--stride-coral)]/30"
          />
          Active (available for new quotes)
        </label>
      </form>
    </SalesDrawer>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--dash-text-muted)]">
        {label}
        {required ? <span className="text-[var(--stride-coral)]"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function ProductsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="dashboard-stat-card">
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--dash-border)]" />
            <div className="mt-3 h-6 w-16 animate-pulse rounded bg-[var(--dash-border)]" />
          </div>
        ))}
      </div>
      <div className={`${DASHBOARD_SURFACE_CLASS} p-4`}>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 flex-1 animate-pulse rounded bg-[var(--dash-border)]" />
              <div className="h-4 w-24 animate-pulse rounded bg-[var(--dash-border)]" />
              <div className="h-4 w-16 animate-pulse rounded bg-[var(--dash-border)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
