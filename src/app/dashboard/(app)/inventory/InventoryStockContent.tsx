'use client';

import { useMemo, useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { toast } from '@/components/ui/toast';
import { apiFetch, useApiResource } from '@/hooks/useApiResource';

type StockRow = {
  id: string;
  facilitySiteName: string;
  productName: string;
  sku: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  atp: number;
  baseUom: string;
};

export default function InventoryStockContent() {
  const stockQuery = useApiResource<{ stock: StockRow[] }>(['inventory', 'stock'], '/api/inventory/stock');
  const sitesQuery = useApiResource<{ sites: Array<{ id: string; name: string }> }>(
    ['inventory', 'sites'],
    '/api/inventory/sites',
  );
  const stock = useMemo(() => stockQuery.data?.stock ?? [], [stockQuery.data]);
  const [busy, setBusy] = useState(false);

  async function receive() {
    const facilitySiteId = window.prompt('Facility site ID') || sitesQuery.data?.sites[0]?.id;
    const productId = window.prompt('Product ID');
    const qtyBase = Number(window.prompt('Qty (base UOM)', '100'));
    if (!facilitySiteId || !productId || !Number.isFinite(qtyBase)) return;
    setBusy(true);
    try {
      await apiFetch('/api/inventory/receipts', {
        method: 'POST',
        body: JSON.stringify({ facilitySiteId, productId, qtyBase }),
      });
      toast.success('Stock received.');
      await stockQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Receive failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Inventory"
        description="Warehouse stock, ATP, and receipts for sales order fulfillment."
        icon={Package}
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={() => void receive()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Receive stock
          </button>
        }
      />
      <DashboardTableCard>
        <DashboardTableViewport minWidth={800}>
          <DashboardTable className="dashboard-table-clean">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Product</th>
                <th className="col-right">On hand</th>
                <th className="col-right">Reserved</th>
                <th className="col-right">ATP</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s.id}>
                  <td>{s.facilitySiteName}</td>
                  <td>
                    {s.productName}
                    {s.sku ? <span className="ml-1 text-xs text-[var(--dash-text-muted)]">{s.sku}</span> : null}
                  </td>
                  <td className="col-right tabular-nums">
                    {s.qtyOnHand} {s.baseUom}
                  </td>
                  <td className="col-right tabular-nums">{s.qtyReserved}</td>
                  <td className="col-right tabular-nums font-medium">{s.atp}</td>
                </tr>
              ))}
              {stock.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-[var(--dash-text-muted)]">
                    No stock rows yet — receive inventory against a warehouse FacilitySite.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </DashboardTable>
        </DashboardTableViewport>
      </DashboardTableCard>
    </DashboardPage>
  );
}
