'use client';

import { useMemo } from 'react';
import { Target, Plus } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { toast } from '@/components/ui/toast';
import { apiFetch, salesKeys, useSalesMutation, useSalesResource } from '@/lib/sales/hooks';

type Territory = {
  id: string;
  name: string;
  code: string | null;
  members: Array<{ employeeId: string; name: string }>;
  beats: Array<{ id: string; name: string; weekday: number; outletCount: number }>;
};

export default function SalesTerritoriesContent() {
  const query = useSalesResource<{ territories: Territory[] }>(
    salesKeys.territories(),
    '/api/sales/territories',
  );
  const territories = useMemo(() => query.data?.territories ?? [], [query.data]);
  const createMutation = useSalesMutation<{ territory: { id: string } }, { name: string; code?: string }>(
    (body) => apiFetch('/api/sales/territories', { method: 'POST', body: JSON.stringify(body) }),
    {
      invalidateKeys: [salesKeys.territories()],
      onSuccess: () => toast.success('Territory created.'),
    },
  );

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Territories"
        description="Route-to-market coverage: territories, reps, and weekly beats."
        icon={Target}
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
            onClick={() => {
              const name = window.prompt('Territory name');
              if (!name) return;
              const code = window.prompt('Code (optional)') || undefined;
              void createMutation.mutateAsync({ name, code });
            }}
          >
            <Plus className="h-4 w-4" /> Add territory
          </button>
        }
      />
      <DashboardTableCard>
        <DashboardTableViewport minWidth={700}>
          <DashboardTable className="dashboard-table-clean">
            <thead>
              <tr>
                <th>Territory</th>
                <th>Reps</th>
                <th>Beats</th>
              </tr>
            </thead>
            <tbody>
              {territories.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">
                    {t.name}
                    {t.code ? <span className="ml-2 text-xs text-[var(--dash-text-muted)]">{t.code}</span> : null}
                  </td>
                  <td>{t.members.map((m) => m.name).join(', ') || '—'}</td>
                  <td>
                    {t.beats.length
                      ? t.beats.map((b) => `${b.name} (D${b.weekday}, ${b.outletCount} outlets)`).join('; ')
                      : '—'}
                  </td>
                </tr>
              ))}
              {territories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-[var(--dash-text-muted)]">
                    No territories yet.
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
