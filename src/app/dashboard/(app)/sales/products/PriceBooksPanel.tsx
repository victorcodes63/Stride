'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { SalesEmptyState } from '@/components/dashboard/sales';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import { apiFetch, salesKeys, useSalesMutation, useSalesResource } from '@/lib/sales/hooks';
import { formatSalesCurrency } from '@/lib/sales/format';

type PriceBookEntry = {
  id: string;
  productId: string;
  unitPrice: number;
  minQty: number;
  product: { id: string; name: string; sku: string | null } | null;
};

type PriceBook = {
  id: string;
  name: string;
  isDefault: boolean;
  currency: string;
  entries: PriceBookEntry[];
  entryCount?: number;
};

type ProductOpt = { id: string; name: string; sku: string | null; unitPrice: number; currency: string };

/**
 * B1 — Manage volume-tier entries on org price books (defaults to Standard).
 */
export function PriceBooksPanel({ products }: { products: ProductOpt[] }) {
  const booksQuery = useSalesResource<{ priceBooks: PriceBook[] }>(
    salesKeys.priceBooks(),
    '/api/sales/price-books',
  );
  const books = booksQuery.data?.priceBooks ?? [];
  const defaultBook = books.find((b) => b.isDefault) ?? books[0] ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    books.find((b) => b.id === selectedId) ?? defaultBook;

  const [productId, setProductId] = useState('');
  const [minQty, setMinQty] = useState('10');
  const [unitPrice, setUnitPrice] = useState('');

  const upsertMutation = useSalesMutation<
    unknown,
    { priceBookId: string; productId: string; minQty: number; unitPrice: number }
  >(
    (body) =>
      apiFetch(`/api/sales/price-books/${body.priceBookId}/entries`, {
        method: 'POST',
        body: JSON.stringify({
          productId: body.productId,
          minQty: body.minQty,
          unitPrice: body.unitPrice,
        }),
      }),
    {
      invalidateKeys: [salesKeys.priceBooks()],
      onSuccess: () => toast.success('Volume tier saved.'),
    },
  );

  const deleteMutation = useSalesMutation<unknown, { priceBookId: string; entryId: string }>(
    ({ priceBookId, entryId }) =>
      apiFetch(`/api/sales/price-books/${priceBookId}/entries?entryId=${entryId}`, {
        method: 'DELETE',
      }),
    {
      invalidateKeys: [salesKeys.priceBooks()],
      onSuccess: () => toast.success('Tier removed.'),
    },
  );

  const entries = useMemo(() => {
    const list = selected?.entries ?? [];
    return [...list].sort((a, b) => {
      const an = a.product?.name ?? a.productId;
      const bn = b.product?.name ?? b.productId;
      if (an !== bn) return an.localeCompare(bn);
      return a.minQty - b.minQty;
    });
  }, [selected]);

  async function addTier() {
    if (!selected) return;
    const qty = Math.floor(Number(minQty));
    const price = Number(unitPrice);
    if (!productId || !Number.isFinite(qty) || qty < 1 || !Number.isFinite(price) || price < 0) {
      toast.error('Pick a product, min qty (≥1), and unit price.');
      return;
    }
    try {
      await upsertMutation.mutateAsync({
        priceBookId: selected.id,
        productId,
        minQty: qty,
        unitPrice: price,
      });
      setMinQty('10');
      setUnitPrice('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save tier.');
    }
  }

  if (booksQuery.isError) {
    return (
      <SalesEmptyState
        icon={BookOpen}
        title="Couldn't load price books"
        description={booksQuery.error?.message ?? 'Something went wrong.'}
        action={
          <button
            type="button"
            onClick={() => void booksQuery.refetch()}
            className="rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
          >
            Retry
          </button>
        }
      />
    );
  }

  if (booksQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--dash-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading price books…
      </div>
    );
  }

  if (!selected) {
    return (
      <SalesEmptyState
        icon={BookOpen}
        title="No price books yet"
        description="The Standard book is created automatically when you add products."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[200px] flex-1">
          <span className="mb-1 block text-xs text-[var(--dash-text-muted)]">Price book</span>
          <StrideSelect
            value={selected.id}
            onChange={setSelectedId}
            ariaLabel="Price book"
            options={books.map((b) => ({
              value: b.id,
              label: `${b.name}${b.isDefault ? ' (default)' : ''}`,
            }))}
          />
        </label>
        <p className="pb-2 text-xs text-[var(--dash-text-muted)]">
          Volume pricing: highest min qty ≤ line quantity wins.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
          Add volume tier
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs text-[var(--dash-text-muted)]">Product</span>
            <StrideSelect
              value={productId}
              onChange={(v) => {
                setProductId(v);
                const p = products.find((x) => x.id === v);
                if (p && !unitPrice) setUnitPrice(String(p.unitPrice));
              }}
              ariaLabel="Product for tier"
              placeholder="Select product"
              options={products.map((p) => ({
                value: p.id,
                label: `${p.name}${p.sku ? ` · ${p.sku}` : ''}`,
              }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--dash-text-muted)]">Min qty</span>
            <input
              type="number"
              min={1}
              step={1}
              value={minQty}
              onChange={(e) => setMinQty(e.target.value)}
              className="dash-auth-input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--dash-text-muted)]">Unit price</span>
            <input
              type="number"
              min={0}
              step="any"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="dash-auth-input w-full"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={upsertMutation.isPending}
            onClick={() => void addTier()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {upsertMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add tier
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <SalesEmptyState
          icon={BookOpen}
          title="No tiers yet"
          description="Catalog list prices sync as min qty 1 on the Standard book. Add higher qty breakpoints for volume discounts."
          compact
        />
      ) : (
        <DashboardTableCard>
          <DashboardTableViewport minWidth={720}>
            <DashboardTable className="dashboard-table-clean">
              <thead>
                <tr>
                  <th className="col-primary">Product</th>
                  <th className="col-right">Min qty</th>
                  <th className="col-right">Unit price</th>
                  <th className="col-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="col-primary col-truncate">
                      {e.product?.name ?? e.productId}
                      {e.product?.sku ? (
                        <span className="ml-1 text-[var(--dash-text-muted)]">· {e.product.sku}</span>
                      ) : null}
                    </td>
                    <td className="col-right tabular-nums">{e.minQty}</td>
                    <td className="col-right tabular-nums">
                      {formatSalesCurrency(e.unitPrice, selected.currency)}
                    </td>
                    <td className="col-right">
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        aria-label="Remove tier"
                        onClick={() => {
                          void deleteMutation
                            .mutateAsync({ priceBookId: selected.id, entryId: e.id })
                            .catch((err) =>
                              toast.error(err instanceof Error ? err.message : 'Delete failed.'),
                            );
                        }}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
          </DashboardTableViewport>
        </DashboardTableCard>
      )}
    </div>
  );
}
