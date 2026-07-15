'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Coins, Loader2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';

type Estimate = {
  employeeId: string;
  employeeName?: string;
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
        description="Estimated incentive payouts from attainment tiers. Payroll handoff is a fast-follow."
        icon={Coins}
      />

      {todo ? (
        <div className="mb-4 rounded-lg border border-amber-200/60 bg-amber-50/10 px-4 py-3 text-sm text-[var(--dash-text-muted)]">
          Coming soon: {todo.replace(/^Wire /, '').replace(/ \(SALES-05.*$/, '')}.
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--dash-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : estimates.length === 0 ? (
        <div className={`${DASHBOARD_SURFACE_CLASS} px-6 py-12 text-center`}>
          <Coins className="mx-auto h-8 w-8 text-[var(--stride-coral)]" />
          <p className="mt-3 font-semibold text-[var(--dash-text-strong)]">No estimates yet</p>
          <p className="mt-1 text-sm text-[var(--dash-text-muted)]">
            Need an active commission rule plus closed revenue for the period.
          </p>
          <Link
            href="/dashboard/sales/attainment"
            className="mt-4 inline-block text-sm font-medium text-[var(--stride-coral)]"
          >
            View attainment →
          </Link>
        </div>
      ) : (
        <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
              <tr>
                <th className="px-4 py-3">Rep</th>
                <th className="px-4 py-3">Attainment</th>
                <th className="px-4 py-3">Revenue</th>
                <th className="px-4 py-3">Est. commission</th>
                <th className="px-4 py-3">Rule</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e) => (
                <tr key={e.employeeId} className="border-t border-[var(--dash-border)]">
                  <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">
                    {e.employeeName ?? e.employeeId.slice(0, 8)}
                  </td>
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
