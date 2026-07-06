'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type Estimate = {
  employeeId: string;
  attainmentPct: number | null;
  revenue: number;
  commissionAmount: number;
  currency: string;
  ruleName: string;
};

export default function SalesCommissionsContent() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [todo, setTodo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/sales/commissions')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed');
        setTodo(typeof data.victorTodo === 'string' ? data.victorTodo : null);
        return data.estimates as Estimate[];
      })
      .then(setEstimates)
      .catch(() => setEstimates([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Commissions"
        description="Estimate incentive payouts from attainment tiers. Payroll handoff is a fast-follow."
      />

      {todo && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>VICTOR TODO:</strong> {todo}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : estimates.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No active commission rule. POST to /api/sales/commissions to configure tiers.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Rep</th>
                <th className="px-4 py-3">Attainment</th>
                <th className="px-4 py-3">Revenue</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Rule</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e) => (
                <tr key={e.employeeId} className="border-t border-neutral-100">
                  <td className="px-4 py-3 font-mono text-xs">{e.employeeId.slice(0, 8)}…</td>
                  <td className="px-4 py-3">
                    {e.attainmentPct != null ? `${e.attainmentPct}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {e.revenue.toLocaleString('en-KE')} {e.currency}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[var(--stride-coral)]">
                    {e.commissionAmount.toLocaleString('en-KE')} {e.currency}
                  </td>
                  <td className="px-4 py-3">{e.ruleName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPage>
  );
}
