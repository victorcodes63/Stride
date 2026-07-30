'use client';

import { useMemo } from 'react';
import { Coins, Plus } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { toast } from '@/components/ui/toast';
import { apiFetch, salesKeys, useSalesMutation, useSalesResource } from '@/lib/sales/hooks';

type Promo = {
  id: string;
  name: string;
  mechanic: string;
  discountPct: number;
  startsOn: string;
  endsOn: string;
  active: boolean;
  claimCount: number;
};

export default function SalesPromotionsContent() {
  const query = useSalesResource<{ promotions: Promo[] }>(salesKeys.promotions(), '/api/sales/promotions');
  const promotions = useMemo(() => query.data?.promotions ?? [], [query.data]);
  const createMutation = useSalesMutation( 
    (body: Record<string, unknown>) =>
      apiFetch('/api/sales/promotions', { method: 'POST', body: JSON.stringify(body) }),
    {
      invalidateKeys: [salesKeys.promotions()],
      onSuccess: () => toast.success('Promotion created.'),
    },
  );

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Promotions"
        description="Trade promotions and claim intake (off-invoice, scan-back, lump sum)."
        icon={Coins}
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
            onClick={() => {
              const name = window.prompt('Promotion name');
              if (!name) return;
              const discountPct = Number(window.prompt('Discount %', '5') || 5);
              const today = new Date().toISOString().slice(0, 10);
              void createMutation.mutateAsync({
                name,
                mechanic: 'off_invoice',
                discountPct,
                startsOn: today,
                endsOn: today,
              });
            }}
          >
            <Plus className="h-4 w-4" /> Add promo
          </button>
        }
      />
      <DashboardTableCard>
        <DashboardTableViewport minWidth={700}>
          <DashboardTable className="dashboard-table-clean">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mechanic</th>
                <th>Discount</th>
                <th>Window</th>
                <th>Claims</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.mechanic}</td>
                  <td>{p.discountPct}%</td>
                  <td>
                    {p.startsOn} → {p.endsOn}
                  </td>
                  <td>{p.claimCount}</td>
                </tr>
              ))}
              {promotions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-[var(--dash-text-muted)]">
                    No promotions yet.
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
