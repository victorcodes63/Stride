'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';

type TargetRow = {
  id: string;
  employee: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  status: string;
};

export default function SalesTargetsContent() {
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/sales/targets')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        return data.targets as TargetRow[];
      })
      .then(setTargets)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setTargets([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id: string) {
    await fetch(`/api/sales/targets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    load();
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Sales targets"
        description="Set and approve quotas per rep or team. Approved targets feed attainment and Performance scorecards."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading targets…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : targets.length === 0 ? (
        <p className="text-sm text-neutral-500">No targets yet. Create via API or seed demo data.</p>
      ) : (
        <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Rep / team</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Quota</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3">
                    {t.employee?.name ?? t.department?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {t.periodStart} → {t.periodEnd}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {t.amount.toLocaleString('en-KE')} {t.currency}
                  </td>
                  <td className="px-4 py-3 capitalize">{t.status.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-right">
                    {t.status === 'pending_approval' && (
                      <button
                        type="button"
                        onClick={() => approve(t.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[var(--stride-coral)] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPage>
  );
}
