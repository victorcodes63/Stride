'use client';

import { useMemo } from 'react';
import { Package, Plus } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { toast } from '@/components/ui/toast';
import { apiFetch, salesKeys, useSalesMutation, useSalesResource } from '@/lib/sales/hooks';

type VanLoad = {
  id: string;
  status: string;
  facilitySiteName: string;
  lineCount: number;
  createdAt: string;
};

export default function SalesVanLoadsContent() {
  const query = useSalesResource<{ vanLoads: VanLoad[] }>(salesKeys.vanLoads(), '/api/sales/van-loads');
  const loads = useMemo(() => query.data?.vanLoads ?? [], [query.data]);
  const createMutation = useSalesMutation(
    (body: Record<string, unknown>) =>
      apiFetch('/api/sales/van-loads', { method: 'POST', body: JSON.stringify(body) }),
    {
      invalidateKeys: [salesKeys.vanLoads()],
      onSuccess: () => toast.success('Van load drafted.'),
    },
  );

  async function issue(id: string) {
    try {
      await apiFetch(`/api/sales/van-loads/${id}/issue`, { method: 'POST', body: '{}' });
      toast.success('Van load issued from warehouse.');
      await query.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Issue failed.');
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Van loads"
        description="Load sheets for field / van sales — issue stock from a warehouse."
        icon={Package}
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
            onClick={() => {
              const facilitySiteId = window.prompt('Warehouse facility site ID');
              const productId = window.prompt('Product ID');
              const qtyBase = Number(window.prompt('Qty base', '24') || 24);
              if (!facilitySiteId || !productId) return;
              void createMutation.mutateAsync({
                facilitySiteId,
                lines: [{ productId, qtyBase }],
              });
            }}
          >
            <Plus className="h-4 w-4" /> New load
          </button>
        }
      />
      <DashboardTableCard>
        <DashboardTableViewport minWidth={700}>
          <DashboardTable className="dashboard-table-clean">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Status</th>
                <th>Lines</th>
                <th className="col-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loads.map((l) => (
                <tr key={l.id}>
                  <td>{l.facilitySiteName}</td>
                  <td>{l.status}</td>
                  <td>{l.lineCount}</td>
                  <td className="col-right">
                    {l.status === 'draft' ? (
                      <button
                        type="button"
                        className="text-sm text-[var(--stride-coral)]"
                        onClick={() => void issue(l.id)}
                      >
                        Issue stock
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
              {loads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-[var(--dash-text-muted)]">
                    No van loads yet.
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
