'use client';

import { useMemo, useState } from 'react';
import { Package, Plus, RefreshCw } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { SalesEmptyState } from '@/components/dashboard/sales';
import { toast } from '@/components/ui/toast';
import { apiFetch, salesKeys, useSalesMutation, useSalesResource } from '@/lib/sales/hooks';

type OrderRow = {
  id: string;
  orderNumber: number;
  status: string;
  currency: string;
  accountsClientName: string | null;
  lineCount: number;
  createdAt: string;
};

export default function SalesOrdersContent() {
  const query = useSalesResource<{ orders: OrderRow[] }>(salesKeys.orders(), '/api/sales/orders');
  const orders = useMemo(() => query.data?.orders ?? [], [query.data]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const createMutation = useSalesMutation<
    { order: OrderRow },
    { accountsClientId: string; facilitySiteId?: string; lines: Array<Record<string, unknown>> }
  >((body) => apiFetch('/api/sales/orders', { method: 'POST', body: JSON.stringify(body) }), {
    invalidateKeys: [salesKeys.orders()],
    onSuccess: () => toast.success('Draft order created.'),
  });

  async function runAction(id: string, path: string, body?: object) {
    setBusyId(id);
    try {
      await apiFetch(`/api/sales/orders/${id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      });
      toast.success(`${path} completed.`);
      await query.refetch();
    } catch (e) {
      const err = e as { status?: number; body?: { code?: string; warnings?: string[] }; message?: string };
      if (err.status === 409 && err.body?.code === 'WARNINGS') {
        const ok = window.confirm(
          `Warnings:\n${(err.body.warnings ?? []).join('\n')}\n\nAcknowledge and continue?`,
        );
        if (ok) {
          try {
            await apiFetch(`/api/sales/orders/${id}/${path}`, {
              method: 'POST',
              body: JSON.stringify({ ...(body ?? {}), acknowledgeWarnings: true }),
            });
            toast.success(`${path} completed.`);
            await query.refetch();
          } catch (e2) {
            toast.error(e2 instanceof Error ? e2.message : `${path} failed.`);
          }
        }
      } else {
        toast.error(err.message ?? `${path} failed.`);
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Orders"
        description="Order-to-cash: confirm (credit + ATP), ship, invoice, and returns."
        icon={Package}
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
            onClick={() => {
              const accountsClientId = window.prompt('Accounts client ID');
              if (!accountsClientId) return;
              const facilitySiteId = window.prompt('Warehouse facility site ID (optional)') || undefined;
              const productId = window.prompt('Product ID') || undefined;
              const description = window.prompt('Line description', 'Order line') || 'Order line';
              const qty = Number(window.prompt('Qty', '10') || 10);
              const unitPrice = Number(window.prompt('Unit price', '100') || 100);
              void createMutation.mutateAsync({
                accountsClientId,
                facilitySiteId,
                lines: [{ productId, description, qtyOrdered: qty, unitPrice, uom: 'each' }],
              });
            }}
          >
            <Plus className="h-4 w-4" /> New order
          </button>
        }
      />

      {query.isError ? (
        <SalesEmptyState
          icon={Package}
          title="Couldn't load orders"
          description={query.error?.message ?? 'Try again.'}
          action={
            <button type="button" onClick={() => void query.refetch()} className="rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm text-white">
              <RefreshCw className="mr-1 inline h-4 w-4" /> Retry
            </button>
          }
        />
      ) : orders.length === 0 ? (
        <SalesEmptyState
          icon={Package}
          title="No orders yet"
          description="Create a draft order, assign a warehouse, then confirm to reserve stock."
        />
      ) : (
        <DashboardTableCard>
          <DashboardTableViewport minWidth={900}>
            <DashboardTable className="dashboard-table-clean">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Lines</th>
                  <th className="col-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium">SO-{o.orderNumber}</td>
                    <td>{o.accountsClientName ?? '—'}</td>
                    <td>{o.status}</td>
                    <td>{o.lineCount}</td>
                    <td className="col-right space-x-2 text-sm">
                      <button type="button" disabled={busyId === o.id} onClick={() => void runAction(o.id, 'confirm')} className="text-[var(--stride-coral)]">
                        Confirm
                      </button>
                      <button type="button" disabled={busyId === o.id} onClick={() => void runAction(o.id, 'ship')} className="text-[var(--stride-coral)]">
                        Ship
                      </button>
                      <button type="button" disabled={busyId === o.id} onClick={() => void runAction(o.id, 'invoice')} className="text-[var(--stride-coral)]">
                        Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
          </DashboardTableViewport>
        </DashboardTableCard>
      )}
    </DashboardPage>
  );
}
